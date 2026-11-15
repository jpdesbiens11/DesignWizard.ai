/* DesignWizard.ai — the part studio under the mouse. The model itself is the control panel : a click selects a face,
   an edge or a point (Ctrl + click adds one or takes it out) and says what it measures ; a right click offers what
   makes sense where the cursor is — a hole, a pocket, a boss or an interface on a face, a fillet or a chamfer on
   the edges chosen, the operation behind a hole, a cut at that level, the view from that face ; the usual keys do
   the same without the menu. A double click on a hole opens the operation that drilled it. */

import { toast } from "../core/dom.js";
import { store } from "../core/store.js";
import { app } from "../core/app.js";
import { featureDialog, interfaceDialog, nextFeatureId, nextIfaceId, FEATURE_DEFAULT, SHOP_DEFAULT } from "../core/part_edit.js";
import { createSelection, popupMenu } from "../core/view_select.js";
import { lightFace, LIT } from "../core/view_marks.js";

export const PART_KEYS = [["Clic", "Sélectionner une face, une arête ou un point"], ["Ctrl + clic", "Ajouter à la sélection, ou en retirer"], ["Clic droit", "Menu : ce qui se fait ici"], ["Double clic", "Ouvrir l'opération d'un perçage"],
  ["H", "Trou sur la face choisie"], ["T", "Taraudage"], ["P", "Poche"], ["B", "Bossage"], ["I", "Interface"], ["R", "Congé sur les arêtes choisies"], ["C", "Chanfrein sur les arêtes choisies"], ["N", "Regarder la face de face"], ["Maj + S", "Inverser la coupe"],
  ["Suppr", "Retirer l'opération du perçage choisi"], ["Échap", "Tout désélectionner"], ["F · 0 à 6", "Cadrer · vues"], ["X · M · S", "Rayons X · mesurer · coupe"], ["Ctrl + Z · Ctrl + Y", "Annuler · rétablir"]];

/** ctx : { st, id, vp, view, chip (status node), faceOfHit(hit), editFeature(index), editIface(id) }. → handlers for the viewport. */
export function partGestures(ctx) {
  const { st, id, vp, view } = ctx, v = vp.viewer, marks = (t) => v.clearOverlays(t);
  const sel = createSelection(v, (items) => { ctx.chip.textContent = items.length ? sel.measure() : ""; ctx.chip.classList.toggle("hidden", !items.length); });
  const push = (feat, label, title) => featureDialog(feat, (nf) => store.updatePart(id, (s) => { s.features = s.features || []; s.features.push(nf); }, label), title);
  const faces = () => sel.items().filter((x) => x.kind === "face"), edges = () => sel.items().filter((x) => x.kind === "edge");
  /** The planar face to work on : the one chosen (when there is exactly one), as { face, at, level }. */
  const target = () => { const f = faces(); return f.length === 1 ? ctx.faceOfHit(f[0].hit) : null; };

  /** A new operation where the designer pointed. f = { face, at, level }. */
  function createAt(kind, f) {
    if (!f) { toast("Choisissez d'abord une face plane, alignée sur X, Y ou Z.", "info"); return; }
    const here = (base, prefix) => { const x = { ...JSON.parse(JSON.stringify(base)), id: nextFeatureId(st.spec, prefix), face: f.face }; if (f.level !== undefined) x.start = f.level; return x; };
    if (kind === "iface") { const it = { id: nextIfaceId(st.spec), type: "bolt_pattern", side: "A", face: f.face, at: f.at }; if (f.level !== undefined) it.level = f.level;
      interfaceDialog(it, (ni) => store.updatePart(id, (s) => { s.interfaces = s.interfaces || []; s.interfaces.push(ni); }, `Interface ${ni.id} ajoutée`), true); }
    else if (kind === "hole") push({ ...here(FEATURE_DEFAULT.hole, "h"), at: f.at }, `Trou ajouté sur ${f.face}`, "Nouveau trou");
    else if (kind === "tap") push(f.level === undefined ? { ...JSON.parse(JSON.stringify(SHOP_DEFAULT.tap)), id: nextFeatureId(st.spec, "t"), face: f.face, at: f.at } : { ...here(FEATURE_DEFAULT.hole, "t"), at: f.at, thread: "M4", depth: 8 }, `Taraudage ajouté sur ${f.face}`, "Nouveau taraudage");
    else if (kind === "pocket") push({ ...here(FEATURE_DEFAULT.pocket, "p"), rect: [Math.round((f.at[0] - 10) * 10) / 10, Math.round((f.at[1] - 5) * 10) / 10, 20, 10] }, `Poche ajoutée sur ${f.face}`, "Nouvelle poche");
    else if (kind === "boss") push({ ...here(FEATURE_DEFAULT.boss, "b"), at: f.at }, `Bossage ajouté sur ${f.face}`, "Nouveau bossage");
    sel.clear();
  }
  /** A fillet or a chamfer on the edges chosen : each is named by its middle, so the operation follows the part when it changes little. */
  function dress(op) {
    const picks = edges().map((x) => ({ near: x.at, tol: 0.3 }));
    if (!picks.length) { toast("Choisissez d'abord une ou plusieurs arêtes (Ctrl + clic pour en ajouter).", "info"); return; }
    push({ op, id: nextFeatureId(st.spec, op === "fillet" ? "r" : "c"), ...(op === "fillet" ? { r: 2 } : { d: 0.5 }), edges: picks.length === 1 ? picks[0] : picks }, `${op === "fillet" ? "Congé" : "Chanfrein"} sur ${picks.length} arête(s)`, op === "fillet" ? "Nouveau congé" : "Nouveau chanfrein");
    sel.clear();
  }
  /** The hole a cylindrical face belongs to (what the kernel remembers of it), or null. */
  function holeOf(x) {
    if (!x || x.kind !== "face" || !x.face || x.face.type !== "cylinder" || !x.face.o || !x.face.axis || !st.built) return null;
    const c = x.face;
    return (st.built.facts.holes || []).find((h) => { if (!h.at) return false; const w = [h.at[0] - c.o[0], h.at[1] - c.o[1], h.at[2] - c.o[2]], t = w[0] * c.axis[0] + w[1] * c.axis[1] + w[2] * c.axis[2]; return Math.hypot(w[0] - t * c.axis[0], w[1] - t * c.axis[1], w[2] - t * c.axis[2]) < 0.05; }) || null;
  }
  function openHole(h) {
    if (!h) return false;
    if (h.iface) { ctx.editIface(h.iface); return true; }
    const i = (st.spec.features || []).findIndex((f, k) => (f.id || `f${k + 1}`) === h.source);
    if (i < 0) return false;
    ctx.editFeature(i); return true;
  }
  function removeHole(h) {
    if (!h || h.iface) { toast(h ? "Ce perçage vient d'une interface : modifiez l'interface." : "Choisissez d'abord la paroi d'un perçage.", "info"); return; }
    store.updatePart(id, (s) => { s.features = (s.features || []).filter((f, k) => (f.id || `f${k + 1}`) !== h.source); }, `${h.source} supprimée`); sel.clear();
  }
  const lookAt = (x) => { if (x && x.normal) v.lookAlong(x.normal); };
  const cutAt = (x) => { const f = x && ctx.faceOfHit(x.hit); if (!f) return; const a = "xyz"["XYZ".indexOf(f.face[1])]; vp.sectionAt(a, x.at["xyz".indexOf(a)]); };

  /* ---------- the mouse ---------- */
  let lastClick = { key: null, t: 0 };
  function onPick(hit, e) {
    if (st.faceAsk && !st.placing) {                              // a dialog waits for a face
      const f = ctx.faceOfHit(hit);
      if (!f) { toast("Ce n'est pas une face plane alignée sur X, Y ou Z.", "warn"); return; }
      marks("face"); marks("facehover"); lightFace(v, hit.id, hit.faceId, { tag: "face", color: LIT.chosen, opacity: 0.7 });
      st.faceAsk(f); return;
    }
    if (st.placing) { const kind = st.placing, f = ctx.faceOfHit(hit); st.placing = null; view.style.cursor = ""; marks("facehover"); if (!f) { toast("Ce n'est pas une face plane alignée sur X, Y ou Z. Correctif : cliquez une face plane.", "warn"); return; } createAt(kind, f); return; }
    const x = sel.at(hit), now = Date.now(), twice = x && lastClick.key === x.key && now - lastClick.t < 420;
    lastClick = { key: x ? x.key : null, t: now };
    if (twice && openHole(holeOf(x))) return;                     // a double click on a hole opens what drilled it
    sel.click(x, !!(e && (e.ctrlKey || e.metaKey)));
  }
  function onHover(hit) {
    if (st.faceAsk || st.placing) { marks("facehover"); if (hit && ctx.faceOfHit(hit)) lightFace(v, hit.id, hit.faceId, { tag: "facehover", color: LIT.hover }); return; }
    sel.hover(sel.at(hit));
  }
  function onMenu(hit, e) {
    const x = sel.at(hit);
    if (x && !sel.has(x)) sel.click(x, !!(e.ctrlKey || e.metaKey));      // a right click on something not chosen chooses it
    const f = target(), ed = edges(), one = sel.count() === 1 ? sel.items()[0] : null, hole = holeOf(one), items = [];
    if (sel.count()) items.push({ title: sel.measure() });
    if (hole) items.push({ label: hole.iface ? `Modifier l'interface ${hole.iface}…` : `Modifier l'opération ${hole.source}…`, icon: "edit", keys: "double clic", run: () => openHole(hole) }, { label: "Retirer cette opération", icon: "trash", keys: "Suppr", disabled: !!hole.iface, run: () => removeHole(hole) }, "—");
    if (f) items.push({ label: "Trou ici", icon: "bolt", keys: "H", run: () => createAt("hole", f) }, { label: "Taraudage ici", icon: "tap", keys: "T", run: () => createAt("tap", f) }, { label: "Poche ici", icon: "section", keys: "P", run: () => createAt("pocket", f) },
      { label: "Bossage ici", icon: "plus", keys: "B", run: () => createAt("boss", f) }, { label: "Interface ici", icon: "interfaces", keys: "I", run: () => createAt("iface", f) }, "—",
      { label: "Regarder cette face", icon: "eye", keys: "N", run: () => lookAt(one) }, { label: "Couper à ce niveau", icon: "section", run: () => cutAt(one) }, "—");
    if (ed.length) items.push({ label: `Congé sur ${ed.length} arête${ed.length > 1 ? "s" : ""}…`, icon: "edit", keys: "R", run: () => dress("fillet") }, { label: `Chanfrein sur ${ed.length} arête${ed.length > 1 ? "s" : ""}…`, icon: "edit", keys: "C", run: () => dress("chamfer") }, "—");
    if (sel.count()) items.push({ label: "Tout désélectionner", icon: "cross", keys: "Échap", run: () => sel.clear() }, "—");
    items.push(...vp.menu(), "—", { label: "Annuler", icon: "undo", keys: "Ctrl+Z", run: () => store.undo() }, { label: "Rétablir", icon: "redo", keys: "Ctrl+Y", run: () => store.redo() }, { label: "Raccourcis…", icon: "help", keys: "?", run: () => ctx.showKeys() });
    popupMenu(e, items);
  }
  /** The keys the viewport does not use itself. */
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase(), f = target(), one = sel.count() === 1 ? sel.items()[0] : null;
    const map = { h: () => createAt("hole", f), t: () => createAt("tap", f), p: () => createAt("pocket", f), b: () => createAt("boss", f), i: () => createAt("iface", f), r: () => dress("fillet"), c: () => dress("chamfer"), n: () => lookAt(one),
      escape: () => { sel.clear(); st.placing = null; view.style.cursor = ""; marks("facehover"); }, delete: () => removeHole(holeOf(one)), backspace: () => removeHole(holeOf(one)), "?": () => ctx.showKeys() };
    if (map[k]) { e.preventDefault(); map[k](); }
  }
  return { onPick, onHover, onMenu, onKey, sel, createAt, place: (kind) => { st.placing = kind; view.style.cursor = "crosshair"; toast("Cliquez une face plane de la pièce : elle s'allume sous le curseur.", "info", 2500); } };
}
