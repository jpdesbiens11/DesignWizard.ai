/* DynamiteOrbit — editing helpers shared by the studios: generic forms for a feature or an interface of the part
   language, with values typed as numbers, expressions or small JSON fragments. */

import { el, field, btn, modal, toast, icon } from "./dom.js";
import { app } from "./app.js";
import { store } from "./store.js";
import { INTERFACE_TYPES } from "../cad/interfaces.js";
import { FACES } from "../cad/vec.js";
import { SHOP_VERBS } from "../cad/shop.js";
import { STOCK_FORMS } from "../cad/stock.js";

/* Fields offered for each operation: [key, label, kind ("num" | "text" | "json"), hint]. */
export const FEATURE_FORMS = {
  box: [["size", "Taille [x, y, z]", "json"], ["at", "Coin minimum [x, y, z]", "json"], ["mode", "Mode (add / cut)", "text"]],
  cylinder: [["d", "Diamètre", "num"], ["h", "Hauteur", "num"], ["at", "Centre de la base [x, y, z]", "json"], ["axis", "Axe (X, Y, Z)", "text"], ["mode", "Mode (add / cut)", "text"]],
  coil: [["d", "Diamètre du tube", "num"], ["di", "Alésage du tube (0 : plein)", "num"], ["r", "Rayon de l'hélice à la base", "num"], ["r1", "Rayon de l'hélice en haut (cône)", "num"], ["h", "Hauteur", "num"], ["turns", "Nombre de tours", "num"], ["at", "Centre de la base [x, y, z]", "json"], ["axis", "Axe (X, Y, Z)", "text"]],
  extrude: [["profile", "Profil", "json", "rect, circle, slot, poly, path, gen…"], ["plane", "Plan (XY, XZ, YZ)", "text"], ["at", "Position du plan", "num"], ["length", "Longueur", "num"], ["mode", "Mode (add / cut)", "text"]],
  revolve: [["profile", "Profil (x = rayon)", "json"], ["plane", "Plan", "text"], ["axis", "Axe", "text"], ["angle", "Angle (°)", "num"]],
  hole: [["face", "Face", "face"], ["at", "Position(s)", "json", "[x,y] · [[x,y],…] · {grid:{…}} · {circle:{…}}"], ["d", "Diamètre", "num"], ["thread", "Filetage (M3, M4…)", "text"], ["depth", "Profondeur ou through", "num"],
    ["cbore", "Lamage {d, depth}", "json"], ["csink", "Fraisure {d, angle}", "json"], ["start", "Niveau de départ", "num"]],
  pocket: [["face", "Face", "face"], ["rect", "Rectangle [x, y, l, h]", "json"], ["profile", "ou profil", "json"], ["r", "Rayon des coins", "num"], ["depth", "Profondeur ou through", "num"], ["start", "Niveau de départ", "num"]],
  pad: [["face", "Face", "face"], ["rect", "Rectangle [x, y, l, h]", "json"], ["r", "Rayon des coins", "num"], ["h", "Hauteur", "num"], ["start", "Niveau de départ", "num"]],
  slot: [["face", "Face", "face"], ["from", "Début [x, y]", "json"], ["to", "Fin [x, y]", "json"], ["w", "Largeur", "num"], ["depth", "Profondeur ou through", "num"]],
  boss: [["face", "Face", "face"], ["at", "Position(s)", "json"], ["d", "Diamètre", "num"], ["h", "Hauteur", "num"], ["tip", "Ø du sommet (bossage en pointe)", "num"], ["hole", "Trou {thread | d, depth}", "json"], ["start", "Niveau de départ", "num"]],
  shell: [["t", "Épaisseur de paroi", "num"], ["open", "Faces ouvertes", "json", '["+Z"]']],
  fillet: [["r", "Rayon", "num"], ["edges", "Arêtes", "json", '"all" · "vertical" · {"face":"+Z"} · {"dir":"X"} · {"box":[…]}']],
  chamfer: [["d", "Taille", "num"], ["edges", "Arêtes", "json"]],
  interfaces: [],
  /* Shop verbs (see cad/shop.js) */
  drill: [["face", "Face", "face"], ["at", "Position(s)", "json", "[x,y] · [[x,y],…] · {grid:{…}} · {circle:{…}}"], ["d", "Diamètre", "num"], ["depth", "Profondeur ou through", "num"]],
  tap: [["face", "Face", "face"], ["at", "Position(s)", "json"], ["thread", "Filetage (M3, M4…)", "text"], ["depth", "Profondeur ou through", "num"]],
  cbore: [["face", "Face", "face"], ["at", "Position(s)", "json"], ["screw", "Vis à tête cylindrique (M3, M4…)", "text"], ["depth", "Profondeur ou through", "num"]],
  csink: [["face", "Face", "face"], ["at", "Position(s)", "json"], ["screw", "Vis à tête fraisée (M3, M4…)", "text"], ["depth", "Profondeur ou through", "num"]],
  ream: [["face", "Face", "face"], ["at", "Position(s)", "json"], ["d", "Diamètre", "num"], ["fit", "Tolérance (H7…)", "text"], ["depth", "Profondeur ou through", "num"]],
  mill: [["face", "Face", "face"], ["rect", "Rectangle [x, y, l, h]", "json"], ["circle", "ou cercle [cx, cy, d]", "json"], ["r", "Rayon des coins (≥ rayon d'outil)", "num"], ["depth", "Profondeur ou through", "num"]],
  groove: [["face", "Face", "face"], ["from", "Début [x, y]", "json"], ["to", "Fin [x, y]", "json"], ["w", "Largeur", "num"], ["depth", "Profondeur", "num"]],
  face: [["face", "Face", "face"], ["to", "Cote à atteindre (niveau le long de l'axe de la face)", "num"]],
  step: [["face", "Face", "face"], ["rect", "Zone [x, y, l, h]", "json"], ["to", "Cote à atteindre", "num"]],
  outline: [["profile", "Contour", "json", "rect, poly, path…"]],
  turn: [["from", "Début le long de l'axe", "num"], ["to", "Fin le long de l'axe", "num"], ["d", "Diamètre obtenu", "num"]],
  bore: [["d", "Diamètre", "num"], ["depth", "Profondeur ou through", "num"], ["face", "Bout de la pièce", "face"]],
  break_edges: [["d", "Taille du chanfrein", "num"], ["edges", "Arêtes", "json"]],
  deburr: [["note", "Consigne (vide = ébavurer, casser les angles)", "text"]],
  finish: [["note", "Finition", "text"]],
};
export const FEATURE_LABEL = { ...Object.fromEntries(Object.entries(SHOP_VERBS).map(([k, v]) => [k, v.label])), box: "Box", cylinder: "Cylinder", coil: "Coil (helical tube)", extrude: "Extrude", revolve: "Revolve", hole: "Hole", pocket: "Pocket", pad: "Pad", slot: "Slot",
  boss: "Boss", arch: "Arch (spring blade)", mark: "Laser marking", shell: "Shell", fillet: "Fillet", chamfer: "Chamfer", interfaces: "— interface geometry —" };
export const FEATURE_DEFAULT = {
  box: { op: "box", size: [20, 20, 10], at: [0, 0, 0] }, cylinder: { op: "cylinder", d: 10, h: 10, at: [0, 0, 0], axis: "Z" }, coil: { op: "coil", d: 4, di: 3, r: 15, h: 40, turns: 6, at: [0, 0, 0], axis: "Z" },
  extrude: { op: "extrude", profile: { rect: [0, 0, 30, 20], r: 2 }, plane: "XY", at: 0, length: 10 }, hole: { op: "hole", face: "+Z", at: [10, 10], d: 5, depth: "through" },
  pocket: { op: "pocket", face: "+Z", rect: [5, 5, 20, 10], r: 2, depth: 3 }, pad: { op: "pad", face: "+Z", rect: [5, 5, 20, 10], r: 1, h: 2 }, slot: { op: "slot", face: "+Z", from: [5, 5], to: [25, 5], w: 4, depth: 2 },
  boss: { op: "boss", face: "+Z", at: [10, 10], d: 8, h: 6, hole: { thread: "M3", depth: 6 } }, shell: { op: "shell", t: 2, open: ["+Z"] }, fillet: { op: "fillet", r: 2, edges: "vertical" }, chamfer: { op: "chamfer", d: 0.5, edges: { face: "+Z" } },
};
/** Shop verbs offered by « Ajouter une opération ». */
export const SHOP_DEFAULT = {
  drill: { op: "drill", face: "+Z", at: [10, 10], d: 5.5, depth: "through" }, tap: { op: "tap", face: "+Z", at: [10, 10], thread: "M4", depth: 8 },
  cbore: { op: "cbore", face: "+Z", at: [10, 10], screw: "M4" }, csink: { op: "csink", face: "+Z", at: [10, 10], screw: "M4" }, ream: { op: "ream", face: "+Z", at: [10, 10], d: 6, fit: "H7", depth: 8 },
  mill: { op: "mill", face: "+Z", rect: [5, 5, 20, 10], r: 3, depth: 3 }, groove: { op: "groove", face: "+Z", from: [5, 5], to: [25, 5], w: 6, depth: 2 },
  step: { op: "step", face: "+Z", rect: [-1, -1, 12, 200], to: 2 }, face: { op: "face", face: "+Z", to: 5 }, turn: { op: "turn", from: 0, to: 10, d: 8 }, bore: { op: "bore", d: 6, depth: 10, face: "+Z" },
  break_edges: { op: "break_edges", d: 0.5, edges: { face: "+Z" } }, deburr: { op: "deburr" }, finish: { op: "finish", note: "Anodisation incolore 10 µm" },
};

const show = (v) => (v === undefined || v === null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));
/** Text typed by the user -> value of the language: number, expression / keyword (string), or JSON. */
export function parseValue(text, kind) {
  const t = String(text).trim();
  if (t === "") return undefined;
  if (kind === "json" || /^[[{"]/.test(t)) { try { return JSON.parse(t); } catch (e) { if (kind === "json" && /^[[{]/.test(t)) throw new Error(`JSON invalide : ${t.slice(0, 40)}…`); } }
  if (/^-?\d+(?:[.,]\d+)?$/.test(t)) return parseFloat(t.replace(",", "."));
  return t;
}
function faceSelect(value) {
  return el("select", null, Object.keys(FACES).map((k) => el("option", { value: k, selected: k === (value || "+Z") }, `${k}  ${{ "+Z": "dessus", "-Z": "dessous", "+X": "droite", "-X": "gauche", "+Y": "arrière", "-Y": "avant" }[k]}`)));
}
/** Ties a face list to the 3D view of the screen behind (app.faces, when a studio offers it) : the face the list names
    lights up ; a click on a face of the part sets the list — and the level of its plane — and the face turns green.
    level : the input that holds the level of the plane (optional). → { node, hint, stop() } */
function faceLink(select, level) {
  const faces = app.faces || null, dot = el("span", { class: "dot", "data-tip": "Orange : la face nommée par la liste. Vert : la face que vous venez de cliquer." }), node = el("div", { class: "face-pick" }, select, faces ? dot : null);
  const lv = () => { const x = level ? parseFloat(String(level.value).replace(",", ".")) : NaN; return Number.isFinite(x) ? x : undefined; };
  const light = () => { dot.classList.remove("ok"); if (faces) faces.light(select.value, lv()); };
  select.addEventListener("change", light); if (level) level.addEventListener("change", light);
  if (faces) { light(); faces.listen((f) => { select.value = f.face; if (level) level.value = f.level !== undefined ? String(f.level) : ""; dot.classList.add("ok"); }); }
  return { node, hint: faces ? "Choisissez dans la liste (la face s'allume) ou cliquez-la dans la vue 3D." : null, float: !!faces, stop: () => { if (faces) faces.stop(); } };
}

/** Dialog to edit one feature. `onSave(feature)` receives the new feature object. */
export function featureDialog(feature, onSave, title, note) {
  const f = JSON.parse(JSON.stringify(feature)), form = FEATURE_FORMS[f.op] || Object.keys(f).filter((k) => !["op", "id", "name"].includes(k)).map((k) => [k, k, "json"]);
  const inputs = {}, err = el("p", { class: "form-error" });
  const name = el("input", { type: "text", value: f.name || "" });
  const rows = [...(note ? [el("p", { class: "atelier-hint", "data-feature-note": "", style: { gridColumn: "1 / -1", margin: 0 } }, icon("info"), ` ${note}`)] : []), field("Nom (libre)", name)];
  let link = null;
  for (const [key, , kind] of form) inputs[key] = { input: kind === "face" ? faceSelect(f[key]) : el("input", { type: "text", value: show(f[key]), spellcheck: false }), kind };
  for (const [key, label, kind, hint] of form) {
    if (kind === "face" && !link) { link = faceLink(inputs[key].input, inputs.start ? inputs.start.input : null); rows.push(field(label, link.node, link.hint)); continue; }
    rows.push(field(label, inputs[key].input, hint || (kind === "num" ? "Nombre, ou expression des paramètres (ex. L/2 - 5)" : null)));
  }
  const save = () => {
    try {
      for (const [key, { input, kind }] of Object.entries(inputs)) { const v = parseValue(input.value, kind === "face" ? "text" : kind); if (v === undefined) delete f[key]; else f[key] = v; }
      if (name.value.trim()) f.name = name.value.trim(); else delete f.name;
      m.close(); onSave(f);
    } catch (e) { err.textContent = e.message; }
  };
  const m = modal(title || `${FEATURE_LABEL[f.op] || f.op} — ${f.id || ""}`, [el("div", { class: "form-row" }, rows), err, el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), btn("Appliquer", save, { primary: true }))], { wide: !(link && link.float), float: !!(link && link.float), onClose: () => link && link.stop() });
}

/** Dialog to edit one interface. `onSave(iface)`. */
export function interfaceDialog(iface, onSave, isNew) {
  const it = JSON.parse(JSON.stringify(iface)), err = el("p", { class: "form-error" });
  const doc = el("p", { class: "muted" });
  const type = el("select", null, Object.entries(INTERFACE_TYPES).map(([k, t]) => el("option", { value: k, selected: k === it.type }, `${t.label} (${k})`)));
  const side = el("select", null, ["A", "B"].map((s) => el("option", { value: s, selected: s === (it.side || "A") }, `Côté ${s}`)));
  const face = faceSelect(it.face);
  const txt = (v) => el("input", { type: "text", value: show(v), spellcheck: false });
  const name = txt(it.name), key = txt(it.key), partner = txt(it.partner), at = txt(it.at || [0, 0]), level = txt(it.level), rot = txt(it.rot);
  const params = el("textarea", { rows: 4, spellcheck: false }), opts = el("textarea", { rows: 3, spellcheck: false }), link = faceLink(face, level);
  const external = el("input", { type: "checkbox", checked: !!it.external });
  const fill = (reset) => {
    const t = INTERFACE_TYPES[type.value];
    doc.textContent = t.doc;
    params.value = JSON.stringify(reset ? t.params : { ...t.params, ...(it.params || {}) }, null, 1);
    opts.value = JSON.stringify(reset ? (side.value === "A" ? t.optsA : t.optsB) : (it.opts || (side.value === "A" ? t.optsA : t.optsB)), null, 1);
  };
  fill(false);
  type.addEventListener("change", () => fill(true));
  side.addEventListener("change", () => { opts.value = JSON.stringify(side.value === "A" ? INTERFACE_TYPES[type.value].optsA : INTERFACE_TYPES[type.value].optsB, null, 1); });
  const save = () => {
    try {
      it.type = type.value; it.side = side.value; it.face = face.value;
      it.name = name.value.trim() || INTERFACE_TYPES[it.type].label;
      for (const [k, input, kind] of [["key", key, "text"], ["partner", partner, "text"], ["at", at, "json"], ["level", level, "num"], ["rot", rot, "num"]]) { const v = parseValue(input.value, kind); if (v === undefined) delete it[k]; else it[k] = v; }
      it.params = JSON.parse(params.value || "{}"); it.opts = JSON.parse(opts.value || "{}");
      if (external.checked) it.external = true; else delete it.external;
      m.close(); onSave(it);
    } catch (e) { err.textContent = `Champ invalide : ${e.message}`; }
  };
  const m = modal(isNew ? "Nouvelle interface" : `Interface ${it.id}`, [doc,
    el("div", { class: "form-row" }, field("Type", type), field("Côté", side, "A et B se font face"), field("Face de la pièce", link.node, link.hint)),
    el("div", { class: "form-row" }, field("Nom", name), field("Clé partagée", key, "La même clé sur l'autre pièce = la même interface"), field("Voisin", partner)),
    el("div", { class: "form-row" }, field("Position sur la face", at, "[x,y] sur ±Z · [x,z] sur ±Y · [y,z] sur ±X"), field("Niveau du plan d'appui", level, "Vide = extérieur de la pièce"), field("Rotation (°)", rot)),
    el("div", { class: "form-row" }, field("Paramètres partagés par les deux côtés", params), field("Options de ce côté", opts)),
    el("label", { class: "check small" }, external, "Interface externe : elle regarde l'extérieur du produit (châssis du client, mur, opérateur) — aucune pièce du projet ne viendra s'y accoupler"),
    err, el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), btn(isNew ? "Ajouter" : "Appliquer", save, { primary: true }))], { wide: !link.float, float: link.float, onClose: () => link.stop() });
}

/** Dialog to choose or edit the raw stock of a part. `onSave(stock | null)` (null removes it). */
export function stockDialog(stock, onSave) {
  const cur = JSON.parse(JSON.stringify(stock || { form: "plate", L: 100, W: 60, t: 6 })), err = el("p", { class: "form-error" }), box = el("div", { class: "form-row" }), hint = el("p", { class: "muted" });
  const form = el("select", null, Object.entries(STOCK_FORMS).map(([k, f]) => el("option", { value: k, selected: k === cur.form }, f.label)));
  const inputs = {};
  const fill = () => {
    const f = STOCK_FORMS[form.value];
    hint.textContent = f.hint;
    box.replaceChildren();
    for (const k of Object.keys(inputs)) delete inputs[k];
    for (const [k, label] of f.dims) { inputs[k] = el("input", { type: "text", value: show(cur[k] ?? (k === "t" ? cur.H : k === "H" ? cur.t : undefined)), spellcheck: false }); box.append(field(label, inputs[k], "Nombre ou expression des paramètres")); }
    if (form.value === "profile") { inputs.profile = el("input", { type: "text", value: show(cur.profile), spellcheck: false }); box.append(field("Section", inputs.profile, "Profil : rect, poly, path, gen…")); }
  };
  fill(); form.addEventListener("change", fill);
  const save = () => {
    try {
      const out = { form: form.value };
      for (const [k, input] of Object.entries(inputs)) { const v = parseValue(input.value, k === "profile" ? "json" : "num"); if (v === undefined) throw new Error(`« ${k} » manquant.`); out[k] = v; }
      if (cur.axis) out.axis = cur.axis;
      m.close(); onSave(out);
    } catch (e) { err.textContent = e.message; }
  };
  const m = modal("Matière première", [el("p", { class: "muted" }, "Ce que l'on prend sur l'étagère avant toute opération. Les cotes sont celles du brut fini ; la plateforme choisit la taille du commerce à acheter."),
    el("div", { class: "form-row" }, field("Forme", form)), hint, box, err,
    el("div", { class: "form-actions" }, stock ? btn("Retirer le brut", () => { m.close(); onSave(null); }, { danger: true }) : null, btn("Annuler", () => m.close()), btn("Appliquer", save, { primary: true }))], { wide: true });
}

/** Tell the user which partner parts adapted after an edit (linked interfaces). */
export function announceLinks(change) {
  if (!change || !change.linked || !change.linked.length) return;
  const parts = [...new Set(change.linked.map((c) => c.part))];
  toast(`Interfaces liées : ${parts.join(", ")} ${parts.length > 1 ? "se sont adaptées" : "s'est adaptée"} automatiquement.`, "success", 5000);
}
export function nextFeatureId(spec, prefix = "f") { let i = (spec.features || []).length + 1, id; do { id = `${prefix}${i++}`; } while ((spec.features || []).some((f) => f.id === id)); return id; }
export function nextIfaceId(spec) { let i = (spec.interfaces || []).length + 1, id; do { id = `IF${i++}`; } while ((spec.interfaces || []).some((f) => f.id === id)); return id; }
export { store };
