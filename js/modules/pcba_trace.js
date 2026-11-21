/* DesignWizard.ai — PCBA screen: the pen. In the detailed layout the designer finishes by hand what the router
   leaves : a click on a pad starts a track of its net, each click adds a corner (0, 45 or 90 degrees, snapped to the
   copper of the net or to the grid), V drops a via and changes layer, a click on copper of the same net ends it.
   The stretch under the cursor is green when it respects the rules of the net and red when it does not — and what
   is red is not laid. One finished track = one undoable step. Also : what a picked piece of copper offers
   (remove, keep, give back to the router, move a corner). */

import { el, btn, badge, field, toast, fmt } from "../core/dom.js";
import { copperLayers } from "../pcba/model.js";
import { boardField, boardBack, boardLabel, boardProse, boardUnit } from "../pcba/board_units.js";
import { copperFaults, pickCopper, snapPoint, angle45, penOf, addTrack, addVia, removeCopper, keepCopper, moveCorner } from "../pcba/manual.js";

const OK = "#2a9d4a", BAD = "#e5484d", INK = "#f5b301";

/** The pen of the layout step. ctx : the step context ; v : the board view ; names : layer key → label.
    → { scene: handlers for the view, panel: node, keys(event), stop() } */
export function penTool(ctx, v, names) {
  const { board, lib, R, ui } = ctx, layers = copperLayers(board.board.layers || 2), free = (net) => layers.filter((l) => !R.planes.some((p) => p.layer === l && p.net !== net));
  const status = el("div", { class: "pen-card" }), say = (t, kind = "warn") => toast(boardProse(t), kind, 4500);
  let hover = null;
  const draw = () => {
    const p = ui.pen, items = [];
    if (p) { for (const r of p.runs) items.push({ pts: r.pts, w: r.w, color: INK }); for (const a of p.vias) items.push({ at: a, d: p.via[0], color: INK }); if (p.pts.length > 1) items.push({ pts: p.pts, w: p.w, color: INK });
      if (hover) items.push({ pts: [p.pts[p.pts.length - 1], hover.at], w: p.w, color: hover.faults.length ? BAD : OK }); }
    v.sketch(items); paint();
  };
  const paint = () => {
    const p = ui.pen; status.replaceChildren();
    if (!p) { status.append(el("p", { class: "muted small", style: { margin: 0 } }, "Cliquez une pastille ou du cuivre : la piste prend son net. Puis un clic par angle ; V pose un via et change de couche ; un clic sur du cuivre du même net termine. Échap annule, Retour arrière retire le dernier point.")); return; }
    status.append(el("p", { style: { margin: "0 0 .4rem" } }, "Net ", el("b", null, p.net), " · ", names[p.layer] || p.layer, " · ", `${p.pts.length - 1 + p.runs.reduce((s, r) => s + r.pts.length - 1, 0)} tronçon(s)`, hover && hover.faults.length ? el("span", { class: "form-error", style: { display: "block" } }, boardProse(hover.faults[0].text)) : null),
      el("div", { class: "form-row tight" }, field("Couche", el("select", { onChange: (e) => { swap(e.target.value); } }, free(p.net).map((l) => el("option", { value: l, selected: l === p.layer }, names[l] || l)))),
        field(boardLabel("Largeur (mm)"), el("input", { type: "number", step: boardUnit() === "mm" ? "0.05" : "any", min: boardField(p.min), value: boardField(p.w), style: { width: "5.6rem" }, onChange: (e) => { const w = boardBack(parseFloat(e.target.value)); if (w >= p.min - 1e-4) { p.w = Math.max(p.min, Math.round(w * 1e4) / 1e4); draw(); } } }))),
      el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } }, btn("Via (V)", () => via(), { small: true, icon: "bolt" }), btn("Terminer", () => finish(), { small: true, primary: true, icon: "check", disabled: p.pts.length < 2 && !p.runs.length }), btn("Annuler", () => cancel(), { small: true, icon: "cross" })));
  };
  const target = (at) => { const p = ui.pen, last = p.pts[p.pts.length - 1], s = snapPoint(board, lib, at, { net: p.net, layer: p.layer }, R), to = s.on === "grid" ? angle45(last, s.at) : s.at;
    return { at: to, on: s.on, faults: Math.hypot(to[0] - last[0], to[1] - last[1]) < 1e-6 ? [] : copperFaults(board, lib, p.net, { pts: [last, to], w: p.w, layer: p.layer }, {}, R) }; };
  const start = (at) => {
    const hit = pickCopper(board, lib, at, layers.filter((l) => ui.layers.has(l)), R);
    if (!hit || !hit.net) { say("Cliquez une pastille ou du cuivre relié à un net pour commencer la piste.", "info"); return; }
    const pen = penOf(board, lib, hit.net, R), ok = free(hit.net), drilled = hit.pad && hit.pad.drill, layer = !drilled && hit.layer && ok.includes(hit.layer) ? hit.layer : ok.includes(ui.penLayer) ? ui.penLayer : ok[0];
    if (!layer) { say("Aucune couche libre pour ce net."); return; }
    const s = snapPoint(board, lib, at, { net: hit.net, layer }, R);
    ui.pen = { net: hit.net, layer, w: pen.w, min: pen.min, via: pen.via, pts: [s.on === "grid" ? hit.at : s.at], runs: [], vias: [] }; hover = null; draw();
  };
  const click = (at) => {
    if (!ui.pen) { start(at); return; }
    const p = ui.pen, t = target(at);
    if (t.faults.length) { say(`Refusé : ${t.faults[0].text}.`); return; }
    if (Math.hypot(t.at[0] - p.pts[p.pts.length - 1][0], t.at[1] - p.pts[p.pts.length - 1][1]) < 1e-6) return;
    p.pts.push(t.at); hover = null;
    if (t.on !== "grid") finish(); else draw();
  };
  const swap = (layer) => { const p = ui.pen; if (!p || layer === p.layer) return; if (p.pts.length > 1) { via(layer); return; } p.layer = layer; ui.penLayer = layer; hover = null; draw(); };
  const via = (to) => {
    const p = ui.pen; if (!p) return;
    const at = p.pts[p.pts.length - 1], ok = free(p.net), next = to || ok[(ok.indexOf(p.layer) + 1) % ok.length], onVia = (board.vias || []).some((x) => x.net === p.net && Math.hypot(x.at[0] - at[0], x.at[1] - at[1]) < 1e-6);
    const faults = onVia ? [] : copperFaults(board, lib, p.net, { at, d: p.via[0], drill: p.via[1] }, {}, R);
    if (faults.length) { say(`Via refusé : ${faults[0].text}.`); return; }
    if (R.pads.some((q) => !q.drill && q.net === p.net && Math.abs(q.x - at[0]) <= q.w / 2 && Math.abs(q.y - at[1]) <= q.h / 2)) { say("Pas de via dans une pastille : la brasure s'y écoulerait. Sortez d'abord de la pastille."); return; }
    if (p.pts.length > 1) p.runs.push({ layer: p.layer, pts: p.pts, w: p.w });
    if (!onVia) p.vias.push(at);
    p.pts = [at]; p.layer = next; ui.penLayer = next; hover = null; draw();
  };
  const finish = () => {
    const p = ui.pen; if (!p) return;
    const runs = [...p.runs, ...(p.pts.length > 1 ? [{ layer: p.layer, pts: p.pts, w: p.w }] : [])];
    if (!runs.length && !p.vias.length) { cancel(); return; }
    const copy = JSON.parse(JSON.stringify(board));                 // laid on a copy first : all or nothing
    for (const a of p.vias) { const r = addVia(copy, lib, { net: p.net, at: a, d: p.via[0], drill: p.via[1] }); if (!r.ok) { say(`Via refusé : ${r.faults[0].text}.`); return; } }
    for (const r of runs) { const x = addTrack(copy, lib, { net: p.net, layer: r.layer, pts: r.pts, w: r.w }); if (!x.ok) { say(`Piste refusée : ${x.faults[0].text}.`); return; } }
    ui.pen = null; ui.net = p.net; hover = null;
    ctx.update((x) => { x.tracks = copy.tracks; x.vias = copy.vias; }, `Piste ${p.net} tracée à la main`);
  };
  const cancel = () => { ui.pen = null; hover = null; draw(); };
  const back = () => { const p = ui.pen; if (!p) return; if (p.pts.length > 1) p.pts.pop(); else if (p.runs.length) { const r = p.runs.pop(); p.pts = r.pts; p.layer = r.layer; if (p.vias.length) p.vias.pop(); } else { cancel(); return; } hover = null; draw(); };
  const keys = (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (!ui.pen) return;
    if (e.key === "Escape") { e.preventDefault(); cancel(); } else if (e.key === "v" || e.key === "V") { e.preventDefault(); via(); } else if (e.key === "Enter") { e.preventDefault(); finish(); } else if (e.key === "Backspace") { e.preventDefault(); back(); }
  };
  draw();
  return { panel: status, keys, scene: { onPick: (h) => click(h.at), onHover: (at) => { if (!ui.pen) return; hover = target(at); draw(); } }, redraw: draw };
}

/** What a picked piece of copper offers. pick : { track } or { via }. → section node, or null when the piece is gone. */
export function copperCard(ctx, pick, names, section) {
  const { board, ui } = ctx, t = pick.track !== undefined ? board.tracks[pick.track] : null, vv = pick.via !== undefined ? board.vias[pick.via] : null, x = t || vv;
  if (!x) return null;
  const len = t ? t.pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - t.pts[i - 1][0], p[1] - t.pts[i - 1][1]) : 0), 0) : 0, mine = !x.auto, drop = () => { ui.pick = null; };
  return section(t ? "Piste sélectionnée" : "Via sélectionné", el("p", { class: "small" }, "Net ", el("b", null, x.net), " · ", boardProse(t ? `${names[t.layer] || t.layer}, ${fmt(t.w)} mm de large, ${fmt(len, 1)} mm de long` : `Ø ${fmt(vv.d)} mm, perçage ${fmt(vv.drill)} mm`), " ", badge(mine ? "tracé à la main" : "posé par le routeur", mine ? "ok" : "neutral")),
    t && t.pts.length ? el("p", { class: "muted small" }, "Glissez un sommet (rond blanc) pour déplacer un angle : le déplacement est refusé s'il enfreint une règle.") : null,
    el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } },
      btn("Supprimer", () => { drop(); ctx.update((b) => removeCopper(b, pick), `${t ? "Piste" : "Via"} ${x.net} supprimé${t ? "e" : ""}`); }, { small: true, icon: "trash", danger: true }),
      btn(mine ? "Rendre au routeur" : "Garder", () => ctx.update((b) => keepCopper(b, pick, !mine), mine ? "Cuivre rendu au routeur" : "Cuivre gardé"), { small: true, icon: mine ? "unlink" : "lock", tip: mine ? "Le routeur pourra de nouveau retirer ce cuivre" : "Le routeur ne touchera plus à ce cuivre" })));
}
/** Moves the corner of the picked track by a drag ; says why when it is refused. */
export function dragCorner(ctx, track, corner, delta) {
  const t = ctx.board.tracks[track]; if (!t) return;
  const g = (q) => Math.round(q * 8) / 8, to = [g(t.pts[corner][0] + delta[0]), g(t.pts[corner][1] + delta[1])], trial = JSON.parse(JSON.stringify(ctx.board)), r = moveCorner(trial, ctx.lib, track, corner, to);
  if (!r.ok) { toast(`Déplacement refusé : ${r.faults[0].text}.`, "warn", 4500); ctx.redraw(); return; }
  ctx.update((b) => { moveCorner(b, ctx.lib, track, corner, to); }, `Sommet d'une piste ${t.net} déplacé`);
}
