/* DynamiteOrbit.ai — the operations of a part, in its construction tree : one line each, as before, and what JP asked on top —
   Ctrl + click and Shift + click choose several operations (core/multi_select.js), a bar then says what is done to them at once
   (On / Off, a copy born off, a folder, delete), each as ONE undoable step ; and a FOLDER ranges a run of operations under one
   line that folds (core/folders.js) : folded for the overview, unfolded for the detail. A folder changes nothing in the part —
   the order of the tree stays the order in which the part is built. */

import { el, icon, btn, onOff, toast } from "../core/dom.js";
import { store } from "../core/store.js";
import { withFeatureOff, copyFeature } from "../core/variants.js";
import { nextFeatureId, FEATURE_LABEL } from "../core/part_edit.js";
import { pickStep, modsOf, isMulti, keepChosen, chosenWords } from "../core/multi_select.js";
import { folderRows, setFolder, renameFolder, dropFolder, nextFolderName, folderState } from "../core/folders.js";
import { folderHead, folderTools, askFolderName } from "../core/folders_ui.js";

const fidOf = (f, i) => f.id || `f${i + 1}`;
/** The lines of the operations of a part. o : { id (part), spec, st (the screen keeps st.fsel and st.fanchor in it), built, icons (pictogram per operation),
    edit(index), redraw(), iconBtn(name, tip, fn, transform) } → [nodes] */
export function featureRows(o) {
  const { id, spec, st } = o, feats = spec.features || [], order = feats.map(fidOf), out = [];
  st.fsel = keepChosen(st.fsel || [], order);
  const chosen = new Set(st.fsel), picks = (f, i) => chosen.has(fidOf(f, i)), n = st.fsel.length;
  const step = (label, fn) => store.updatePart(id, fn, label);
  if (n > 1) {
    const mine = feats.filter(picks), allOff = mine.every((f) => f.suppressed), words = chosenWords(n, "opération", "opérations", true), clear = () => { st.fsel = []; o.redraw(); };
    out.push(el("div", { class: "batch-bar", role: "group", "aria-label": words, "data-batch": "features" }, el("b", null, words),
      btn(allOff ? "On" : "Off", () => step(`${n} opérations ${allOff ? "remises à On" : "mises à Off"}`, (x) => { x.features = x.features.map((f, i) => (picks(f, i) && f.op !== "interfaces" ? withFeatureOff(f, !allOff) : f)); }), { small: true, icon: "power", tip: allOff ? "Remettre à On les opérations choisies" : "Mettre à Off les opérations choisies : gardées, elles ne sont pas faites" }),
      btn("Dupliquer", () => { step(`${n} opérations dupliquées (copies à Off)`, (x) => { const at = x.features.map((f, i) => (picks(f, i) && f.op !== "interfaces" ? i : -1)).filter((i) => i >= 0).reverse(); for (const i of at) x.features = copyFeature(x.features, i, nextFeatureId(x)); }); st.fsel = []; }, { small: true, icon: "copy", tip: "Une copie de chaque opération choisie, née à Off, juste après l'originale" }),
      btn("Dossier", async () => { const name = await askFolderName(nextFolderName(feats)); if (!name) return; step(`${n} opérations rangées dans « ${name} »`, (x) => { x.features = setFolder(x.features, picks, name); }); st.fsel = []; toast(`Dossier « ${name} » : ${n} opérations. Il se replie d'un clic ; la pièce n'a pas changé.`, "success", 4200); }, { small: true, icon: "folder", tip: "Ranger les opérations choisies dans un dossier repliable — la pièce ne change pas" }),
      btn("Supprimer", () => { step(`${n} opérations supprimées`, (x) => { x.features = x.features.filter((f, i) => !picks(f, i)); }); st.fsel = []; toast(`${n} opérations supprimées. Ctrl + Z pour revenir.`, "info", 4200); }, { small: true, icon: "trash", danger: true, tip: "Supprimer les opérations choisies — une seule étape, annulable" }),
      el("button", { class: "icon-btn", type: "button", "aria-label": "Ne plus rien choisir", "data-tip": "Ne plus rien choisir", onClick: clear }, icon("close"))));
  }
  const line = (f, i, inFolder) => {
    const fid = fidOf(f, i), err = o.built && o.built.log.some((l) => l.feature === fid && l.level === "error");
    return el("div", { class: "nav-item" + (f.suppressed ? " off is-off" : "") + (err ? " err" : "") + (chosen.has(fid) ? " multi" : "") + (inFolder ? " in-folder" : ""), role: "button", tabindex: "0", "data-feature": fid,
      "data-tip": "Clic : modifier l'opération · Ctrl + clic : en choisir plusieurs · Maj + clic : toute une suite",
      onClick: (e) => { if (isMulti(e)) { e.preventDefault(); const r = pickStep(st.fsel, order, fid, modsOf(e), st.fanchor ?? null); st.fsel = r.ids; st.fanchor = r.anchor; o.redraw(); } else { st.fsel = []; st.fanchor = fid; o.edit(i); } },
      onKeydown: (e) => { if (e.key === "Enter") o.edit(i); } },
      icon(o.icons[f.op] || "part"), el("span", { class: "grow" }, f.name || FEATURE_LABEL[f.op] || f.op), el("small", null, fid),
      /* On / Off, and a copy born off : close cousins of the part kept in one part (core/variants.js) */
      f.op !== "interfaces" && onOff(!f.suppressed, (on) => step(`${fid} ${on ? "remise à On" : "mise à Off"}`, (x) => { x.features[i] = withFeatureOff(x.features[i], !on); }), fid,
        f.suppressed ? `${fid} est de côté (Off) : l'opération n'est pas faite — cliquer pour la remettre (On)` : `${fid} est faite (On) — cliquer pour la mettre de côté (Off) sans la perdre`),
      f.op !== "interfaces" && o.iconBtn("copy", `Dupliquer ${fid} : la copie naît à Off — changez-y une cote, mettez-la à On à la place de ${fid}`, () => step(`${fid} dupliquée (copie à Off)`, (x) => { x.features = copyFeature(x.features, i, nextFeatureId(x)); })),
      i > 0 && o.iconBtn("chevron-down", "Monter dans l'arbre", () => step(`${fid} montée`, (x) => { const [a] = x.features.splice(i, 1); x.features.splice(i - 1, 0, a); }), "rotate(180deg)"),
      o.iconBtn("trash", "Supprimer", () => step(`${fid} supprimée`, (x) => { x.features.splice(i, 1); })));
  };
  for (const r of folderRows(feats, { runs: true })) {
    if (r.kind === "item") { out.push(line(r.item, r.index, false)); continue; }
    const s = folderState(r.rows, { offKey: "suppressed" }), ids = r.rows.map((x) => fidOf(x.item, x.index)), inRun = (f, i) => ids.includes(fidOf(f, i));
    const bad = o.built && r.rows.some((x) => o.built.log.some((l) => l.feature === fidOf(x.item, x.index) && l.level === "error"));
    const F = folderHead({ scope: `part:${id}`, key: r.key, name: r.name, note: s.note, redraw: o.redraw, flag: bad ? el("span", { class: "folder-flag", "data-tip": "Une opération de ce dossier est en erreur" }, "!") : null,
      onAll: () => { st.fsel = [...new Set([...st.fsel, ...ids])]; st.fanchor = ids[0]; o.redraw(); },
      tools: [onOff(!s.allOff, (on) => step(`Dossier « ${r.name} » ${on ? "à On" : "à Off"}`, (x) => { x.features = x.features.map((f, i) => (inRun(f, i) && f.op !== "interfaces" ? withFeatureOff(f, !on) : f)); }), r.name, s.allOff ? "Tout le dossier est à Off — cliquer pour remettre ses opérations à On" : "Mettre à Off toutes les opérations du dossier, d'un coup"),
        ...folderTools({ name: r.name, rename: (to) => step(`Dossier « ${r.name} » renommé « ${to} »`, (x) => { x.features = renameFolder(x.features, r.name, to); }), drop: () => step(`Dossier « ${r.name} » défait`, (x) => { x.features = dropFolder(x.features, r.name); }) })] });
    out.push(F.head); if (!F.folded) for (const x of r.rows) out.push(line(x.item, x.index, true));
  }
  return out;
}
