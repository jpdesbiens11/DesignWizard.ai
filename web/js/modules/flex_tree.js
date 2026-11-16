/* DesignWizard.ai — Circuits flexibles : the branched circuit. A wide core, flat — the layer under (or over) a rigid board —
   and branches of their own widths that leave it along X or Y and fold toward Z+ or Z− to the points they serve. Left, what
   is entered : the core, the film, the rigid board shown over or under it. Centre, the circuit in 3D : a click chooses a
   branch, a right click on the core starts one toward the nearest edge, the arrows slide and lengthen the chosen one.
   Right, what is chosen and obtained : the branches grouped by the edge they leave, each with the picture of its end —
   probe, voltage tap, clipped tongue, bare pads — and the table of tracks and widths. The rules : core/flex_tree.js. */

import { el, clear, icon, svg, btn, badge, field, toast, fmt, fmtMass, debounce, modal, copyText, table } from "../core/dom.js";
import { go, setStatus, setContext, setGuide } from "../core/app.js";
import { store } from "../core/store.js";
import { kernel } from "../cad/client.js";
import { createViewport, showBuilt } from "../core/viewport.js";
import { toDwiz } from "../core/dwiz.js";
import { aiRead, aiDiff } from "../core/ai_loop.js";
import { guideBox, needField, nudge } from "../core/guide.js";
import { WELD_PROCESSES } from "../cad/interfaces_elec.js";
import { BEND_RATIO } from "../core/flex.js";
import { EDGES, ENDS, FOLDS, isTree, tracksOf, widthNeeded, tipSpot, treeChecks, treeGuide, whereOn, centerLine, treePart, tidyTree, addBranch } from "../core/flex_tree.js";

export const END_COLOR = { temp: "#25ad9f", volt: "#ee8a32", slot: "#8a7df0", free: "#5b7fa6" }, EDGE_COLOR = { "+X": "#d6453d", "-X": "#e08a55", "+Y": "#2f9e5b", "-Y": "#7fae3a" };
const KEYS = [["Clic sur une branche", "La choisir"], ["Clic droit sur le cœur", "Une branche vers le bord le plus proche, à cet endroit"], ["← →", "Glisser la branche choisie le long de son bord (Maj : 5 mm · Alt : 0,1 mm)"], ["↑ ↓", "Allonger ou raccourcir sa dernière partie"], ["Tab · Suppr", "Branche suivante · retirer la branche choisie"]];
const fr = (x, d = 2) => fmt(x, d), r2 = (x) => Math.round(x * 100) / 100;
const pic = (color, w, ...kids) => svg("svg", { viewBox: "0 0 48 30", width: w, height: w * 30 / 48, class: "cf-icon", "aria-hidden": "true", style: `--dom:${color}` }, ...kids.flat(Infinity));
const film = (x1 = 2, x2 = 30) => svg("rect", { x: x1, y: 11, width: x2 - x1, height: 8, rx: 1.5, fill: "currentColor", "fill-opacity": 0.16, stroke: "currentColor", "stroke-width": 1.3 });
const dom = (tag, a) => svg(tag, { fill: "var(--dom)", ...a }), stroke = (d, w = 1.8, extra = {}) => svg("path", { d, fill: "none", stroke: "var(--dom)", "stroke-width": w, "stroke-linecap": "round", "stroke-linejoin": "round", ...extra });
const END_DRAW = {
  /* a bead on the film, and the warmth it reads */
  temp: () => [film(2, 34), dom("circle", { cx: 26, cy: 15, r: 4.6 }), stroke("M38 8 q3 3.5 0 7 q-3 3.5 0 7", 1.5), stroke("M43 10 q2.4 2.5 0 5 q-2.4 2.5 0 5", 1.3)],
  /* a bare pad welded on a bar, and the potential it brings back */
  volt: () => [film(2, 26), dom("rect", { x: 22, y: 9, width: 11, height: 12, rx: 1.2 }), dom("path", { d: "M41 3 L35.5 15 H39.5 L37.5 27 L45.5 12.5 H41.5 Z" })],
  /* a stiffened tongue slipped into a slot, held by its clip */
  slot: () => [film(2, 24), dom("rect", { x: 20, y: 12, width: 18, height: 6, rx: 1 }), svg("path", { d: "M30 5 H45 V25 H30 M30 5 V9 L33.5 11.2 M30 25 V21 L33.5 18.8", fill: "none", stroke: "currentColor", "stroke-width": 1.7, "stroke-linejoin": "round", "stroke-linecap": "round" })],
  /* bare pads at the tip, for wires or a component */
  free: () => [film(2, 44), ...[22, 30, 38].map((x) => dom("rect", { x, y: 12.5, width: 4.6, height: 5, rx: 0.8 }))],
};
export const endIcon = (end, w = 64) => pic(END_COLOR[end] || END_COLOR.free, w, (END_DRAW[end] || END_DRAW.free)());
const ARROW = { "+X": "M32 15 H44 M39.5 10.5 L44 15 L39.5 19.5", "-X": "M16 15 H4 M8.5 10.5 L4 15 L8.5 19.5", "+Y": "M24 8 V1.5 M20 5 L24 1.5 L28 5", "-Y": "M24 22 V28.5 M20 25 L24 28.5 L28 25" };
export const edgeIcon = (edge, w = 46) => pic(EDGE_COLOR[edge], w, svg("rect", { x: 16, y: 8, width: 16, height: 14, rx: 1.5, fill: "currentColor", "fill-opacity": 0.16, stroke: "currentColor", "stroke-width": 1.3 }), stroke(ARROW[edge] || ARROW["+X"], 2.4));
const board = (y) => svg("rect", { x: 12, y, width: 24, height: 6.5, rx: 1, fill: "#3e9a5f", "fill-opacity": 0.75, stroke: "#2c7446", "stroke-width": 1.1 });
const RIGID = { none: { fr: "Sans carte", text: "Le cœur seul : la carte n'est pas montrée", draw: () => [] }, over: { fr: "Carte dessus", text: "La carte rigide repose sur le cœur : le circuit est la couche du dessous", draw: () => [board(8)] }, under: { fr: "Carte dessous", text: "La carte rigide porte le cœur : le circuit est la couche du dessus", draw: () => [board(16.5)] } };
const rigidIcon = (k, w = 64) => pic("#c98a1c", w, RIGID[k].draw(), stroke("M3 21 Q3 15.5 9 15.5 H39 Q45 15.5 45 10", 2.6));
const KIND = {
  strip: { fr: "Bande pliée", text: "Une bande de largeur constante, pliée, des capteurs posés le long", color: "#5b7fa6", draw: () => [stroke("M4 24 H20 Q24 24 24 20 V12 Q24 8 28 8 H44", 3.2), dom("circle", { cx: 14, cy: 24, r: 2.6 }), dom("circle", { cx: 36, cy: 8, r: 2.6 })] },
  tree: { fr: "Circuit ramifié", text: "Un cœur large et des branches de largeurs différentes, vers X ou Y, pliées vers Z+ ou Z−", color: "#c98a1c", draw: () => [svg("rect", { x: 15, y: 9, width: 18, height: 12, rx: 1.5, fill: "var(--dom)", "fill-opacity": 0.3, stroke: "var(--dom)", "stroke-width": 1.5 }), stroke("M33 12 H45", 2.6), stroke("M33 18 H41 V26", 1.8), stroke("M21 9 V3", 3.2), stroke("M15 15 H4", 2)] },
  example: { fr: "Exemple : sept branches", text: "Une carte de mesure : le cœur sous une carte rigide, sept branches vers des prises de tension, des sondes, une fente clipsée et un faisceau", color: "#8a7df0",
    draw: () => [board(9.5), stroke("M36 11 H45 M36 15 H42 V22 M36 19 H40", 1.6), stroke("M18 9.5 V3 M29 9.5 V5 H34", 1.8), stroke("M12 13 H3", 3), stroke("M24 16 V27", 1.5)] },
};
/** The kinds of flexible circuit one can start from, as tiles. pick(kind) : "strip" | "tree" | "example". */
export function kindTiles(pick) {
  return el("div", { class: "cf-tiles", role: "group", "aria-label": "Quel circuit flexible" }, Object.entries(KIND).map(([k, K]) => el("button", { class: "cf-tile", type: "button", "data-flex-kind": k, "data-tip": K.text, style: `--dom:${K.color}`, onClick: () => pick(k) }, pic(K.color, 96, K.draw()), el("b", null, K.fr), el("small", { class: "muted" }, K.text))));
}
const tiles = (cls, items) => el("div", { class: `cf-tiles ${cls}`, role: "group" }, items);
const tile = (o) => el("button", { class: `cf-tile${o.sel ? " sel" : ""}`, type: "button", "aria-pressed": o.sel ? "true" : "false", "data-tip": o.tip || null, style: `--dom:${o.color}`, onClick: o.run, ...o.data }, o.pic, el("b", null, o.label));
/** What goes to an AI : the definition alone, behind a short request ; the answer brings the definition back. */
const request = (spec) => ["Tu es l'assistant de conception de DesignWizard.ai. Voici un circuit flexible ramifié : un cœur large, à plat, et des branches qui le quittent vers les points à mesurer. Seul son bloc « flex » se modifie, la géométrie sera réécrite par la plateforme.",
  "ENTREVUE — pose-moi au plus cinq questions, une à la fois : quels points mesurer (tension, température), où ils sont par rapport au cœur (vers X ou Y, plus haut ou plus bas), quelles branches finissent dans une fente clipsée ou sur des plages à braser, la carte rigide est-elle sur ou sous le cœur. Puis résume en trois lignes et attends mon accord.",
  "RÉPONSE ATTENDUE — un seul bloc ```dwiz avec la pièce entière, bloc « flex » à jour : « core » (L, W), « rigid » (side over ou under, t — rien s'il n'y a pas de carte), une ligne « branch » par branche (id, edge +X -X +Y ou -Y, at : sa place le long du bord en mm, w : sa largeur, legs : L puis bend 90 pour un pli vers Z+ et -90 vers Z−, end : temp, volt, slot ou free, net pour une prise de tension, on : ce qu'elle rejoint, tracks). Garde les repères des branches existantes. Après le bloc, liste ce que tu as changé.",
  "", toDwiz(spec).trimEnd()].join("\n");

/** The screen of one branched circuit. ctx : { id, left, right, view, head() → the head of the left pane, list() → the circuits of the project } → cleanup */
export function renderTree(ctx) {
  const { id, left, right, view } = ctx, st = { sel: null, token: 0, built: null, first: true }, def = () => store.part(id).flex;
  const rewrite = (x, d) => { const next = treePart(d, id, x); for (const k of Object.keys(x)) if (k !== "id") delete x[k]; Object.assign(x, next); };
  const change = (label, fn) => store.updatePart(id, (x) => { const d = JSON.parse(JSON.stringify(x.flex)); fn(d); rewrite(x, d); }, label);
  const item = (d = def()) => d.branches.find((b) => b.id === st.sel) || null;
  const edit = (label, fn) => change(label, (d) => { const b = d.branches.find((q) => q.id === st.sel); if (b) fn(b, d); });
  const choose = (bid) => { st.sel = bid; mark(); renderRight(); };
  const add = (edge, o = {}) => change(`Branche vers ${EDGES[edge].fr.slice(5)}`, (d) => { st.sel = addBranch(d, edge, o).id; });
  const remove = (bid) => { if (st.sel === bid) st.sel = null; change(`${bid} retirée`, (d) => { d.branches = d.branches.filter((q) => q.id !== bid); }); };
  const fold = (bend) => edit(`${st.sel} : pli vers ${bend > 0 ? "Z+" : "Z−"}`, (b) => { b.legs.push({ L: 12, bend }); });
  const spot = (h) => (h && (h.local || h.point) ? whereOn(def(), h.local || h.point) : null);
  const menuFor = (h) => {
    const w = spot(h); if (!w) return h ? [{ title: "Ni le cœur ni une branche" }] : null;
    if (w.branch) { const b = def().branches.find((q) => q.id === w.branch); return [{ title: `${b.id} — ${ENDS[b.end].fr.toLowerCase()}, ${EDGES[b.edge].fr}` }, { label: `Choisir ${b.id}`, icon: "check", run: () => choose(b.id) },
      ...FOLDS.map(([v, l]) => ({ label: `Ajouter un ${l}`, icon: "layers", run: () => { st.sel = b.id; fold(v); } })), { label: `Retirer ${b.id}`, icon: "trash", run: () => remove(b.id) }]; }
    return [{ title: `Cœur — bord ${w.edge}, à ${fr(w.at, 1)} mm` }, ...Object.entries(ENDS).map(([k, E]) => ({ label: `${E.fr} ${EDGES[w.edge].fr}, ici`, icon: k === "temp" ? "sensor" : k === "volt" ? "power" : k === "slot" ? "mate" : "chip", run: () => add(w.edge, { at: w.at, end: k }) }))];
  };
  const onKey = (e) => {
    const b = item(), k = e.key, step = e.altKey ? 0.1 : e.shiftKey ? 5 : 1, all = def().branches;
    if (k === "Tab" && all.length) { e.preventDefault(); choose(all[(all.findIndex((q) => q.id === st.sel) + 1) % all.length].id); return; }
    if (!b) return;
    const slide = { ArrowRight: 1, ArrowLeft: -1 }[k], grow = { ArrowUp: 1, ArrowDown: -1 }[k];
    if (slide) { e.preventDefault(); edit(`${b.id} glissée`, (q) => { q.at = r2(q.at + slide * step); }); }
    else if (grow) { e.preventDefault(); edit(`${b.id} ${grow > 0 ? "allongée" : "raccourcie"}`, (q) => { const g = q.legs.at(-1); g.L = r2(Math.max(3, g.L + grow * step)); }); }
    else if (k === "Delete" || k === "Backspace") { e.preventDefault(); remove(b.id); }
  };
  const vp = createViewport(view, { name: () => id, explode: false, select: false, menuFor, onKey, keys: KEYS,
    onPick: (h) => { const w = spot(h); if (w && w.branch) choose(w.branch); else if (w) toast("Clic droit sur le cœur : une branche part vers le bord le plus proche, à cet endroit.", "info", 4000); return true; } });
  const info = el("span", { class: "chip" }, "—"), verdict = el("span", { class: "chip" }, "");
  vp.setStatus(info, verdict);
  function mark() {
    const v = vp.viewer, d = def(); v.clearOverlays("ft");
    for (const b of d.branches) { if (!EDGES[b.edge] || !b.legs.length) continue; const on = b.id === st.sel, tip = tipSpot(d, b, 0, 1).p;
      v.addLabel(tip, b.end === "volt" && b.net ? `${b.id} ${b.net}` : b.id, "ft", on ? "iface" : "label");
      if (on) { v.addPath(centerLine(d, b), END_COLOR[b.end] || "#ff8a3d", "ft", 0.7); v.addMarker(tip, END_COLOR[b.end] || "#ff8a3d", "ft", 1.2); } }
  }
  async function build() {
    const token = ++st.token, spec = store.part(id);
    try {
      const built = await kernel.build(spec); if (token !== st.token) return;
      st.built = built; setContext({ spec, built }); vp.viewer.clear(); showBuilt(vp.viewer, built, { prefix: "ft" }); if (st.first) { vp.viewer.view("iso"); st.first = false; } mark();
      const d = spec.flex, c = treeChecks(d), errs = built.log.filter((l) => l.level === "error"), bad = c.notes.filter((n) => n.level === "bad").length, todo = c.notes.filter((n) => n.level === "todo").length, chk = c.notes.filter((n) => n.level === "check").length;
      info.textContent = `${d.branches.length} branche(s) · ${c.tracks} piste(s) · ${d.branches.reduce((a, b) => a + b.legs.length - 1, 0)} pli(s) · ${d.rigid ? `carte ${d.rigid.side === "under" ? "dessous" : "dessus"}` : "sans carte"} · ${fmtMass(built.mass)}`;
      verdict.textContent = errs.length ? "ne se construit pas" : bad ? `${bad} à corriger` : todo ? `${todo} à entrer` : chk ? `${chk} à vérifier` : "dans les règles"; verdict.className = `chip ${errs.length || bad ? "bad" : todo || chk ? "warn" : "done"}`;
      verdict.dataset.tip = [...errs.map((e) => e.msg), ...c.notes.map((n) => n.text)].join(" · ") || "Largeurs, plis et bouts suivent les règles du métier";
      setStatus(`${id} construit`, "done");
    } catch (e) { if (token === st.token) { info.textContent = e.message; info.className = "chip bad"; } }
  }
  /* where the guide sends the designer : the branch, then its field */
  function goTo(x) {
    if (x.id && def().branches.some((b) => b.id === x.id)) { st.sel = x.id; mark(); renderRight(); }
    const f = x.field === "rigid" ? left.querySelector("[data-rigid-box]") : x.field === "add" ? right.querySelector("[data-add-box]") : x.field === "r" ? left.querySelector('[data-core="r"]') : right.querySelector(`[data-f="${x.field}"]`) || right.querySelector("[data-branch-card]");
    if (f) nudge(f);
  }
  const guide = () => treeGuide(def()).map((x) => ({ ...x, go: () => goTo(x) }));
  /* the round trip with an AI : what comes back is shown before it is applied, in one undoable step */
  function reimport() {
    const area = el("textarea", { rows: 9, placeholder: "Collez la réponse de l'assistant : elle contient la pièce dans un bloc ```dwiz." }), out = el("div"); let next = null;
    const ok = btn("Appliquer ces changements", () => { if (!next) return; store.updatePart(id, (x) => rewrite(x, next), `${id} : circuit mis à jour par l'IA`); m.close(); toast("Circuit réécrit depuis la définition revenue de l'IA.", "success"); }, { primary: true, icon: "check", disabled: true });
    area.addEventListener("input", () => { next = null; ok.disabled = true; out.replaceChildren(); if (!area.value.trim()) return;
      try { const doc = aiRead(area.value); if (!doc || !isTree(doc.flex)) throw new Error("La réponse ne contient pas de circuit ramifié : un bloc « flex » avec son « core » et ses lignes « branch »."); const d = tidyTree(doc.flex), diff = aiDiff(def(), d);
        out.append(el("p", null, diff.length ? `${diff.length} changement(s) :` : "Aucun changement dans la définition."), el("ul", { class: "decisions" }, diff.slice(0, 30).map((x) => el("li", null, `${x.path} — ${x.text}`))), guideBox(treeGuide(d), { title: "Ce que le circuit revenu demande" }) || el("p", { class: "guide-ok small" }, icon("check"), " Le circuit revenu est dans les règles."));
        if (diff.length) { next = d; ok.disabled = false; }
      } catch (e) { out.append(el("p", { class: "form-error" }, e.message)); } });
    const m = modal(`Réimporter ${id} depuis une IA`, [field("Réponse de l'assistant", area), out, el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), ok)], { wide: true });
  }
  function renderLeft() {
    clear(left); const d = def(), slow = debounce((label, fn) => change(label, fn), 350);
    const num = (get, set, label, step = 0.5, min = 0.01, attr = null) => field(label, el("input", { type: "number", value: get(d), step, min, "data-core": attr, onInput: (e) => { const v = parseFloat(e.target.value); if (v >= min) slow(`Circuit : ${label}`, (x) => set(x, v)); } }));
    left.append(ctx.head()); const scroll = el("div", { class: "side-scroll" }); left.append(scroll); scroll.append(ctx.list());
    scroll.append(el("div", { class: "side-section" }, el("h3", null, "Le cœur"), field("Nom", el("input", { type: "text", value: d.name, onChange: (e) => change("Circuit : nom", (x) => { x.name = e.target.value; }) })),
      el("div", { class: "form-row tight" }, num((x) => x.core.L, (x, v) => { x.core.L = v; }, "Longueur X (mm)", 1, 5), num((x) => x.core.W, (x, v) => { x.core.W = v; }, "Largeur Y (mm)", 1, 5)),
      el("div", { class: "form-row tight" }, num((x) => x.t, (x, v) => { x.t = v; }, "Film (mm)", 0.05), num((x) => x.r, (x, v) => { x.r = v; }, "Rayon de pli", 0.5, 0.1, "r"), num((x) => x.gap, (x, v) => { x.gap = v; }, "Entre pistes", 0.05, 0.1)),
      el("div", { class: "form-row tight" }, field("Cuivre", el("select", { onChange: (e) => change("Circuit : cuivre", (x) => { x.cu = +e.target.value; }) }, [[0.018, "18 µm"], [0.035, "35 µm"], [0.07, "70 µm"]].map(([v, l]) => el("option", { value: v, selected: v === d.cu }, l)))),
        field("Faces", el("select", { "data-tip": `Rayon de pli au moins ${BEND_RATIO[1]} × l'épaisseur en simple face, ${BEND_RATIO[2]} × en double face`, onChange: (e) => change("Circuit : faces", (x) => { x.layers = +e.target.value; }) }, [[1, "Simple face"], [2, "Double face"]].map(([v, l]) => el("option", { value: v, selected: v === d.layers }, l)))))));
    const cur = d.rigid ? d.rigid.side : "none";
    scroll.append(el("div", { class: "side-section", "data-rigid-box": "" }, el("h3", null, "La carte rigide"),
      tiles("", Object.entries(RIGID).map(([k, R]) => tile({ sel: k === cur, color: k === "none" ? "#8a8f98" : "#3e9a5f", label: R.fr, tip: R.text, pic: rigidIcon(k), data: { "data-rigid": k }, run: () => change(`Carte rigide : ${R.fr.toLowerCase()}`, (x) => { x.rigid = k === "none" ? null : { side: k, t: (x.rigid && x.rigid.t) || 1.6 }; }) }))),
      d.rigid ? el("div", { class: "form-row tight" }, num((x) => x.rigid.t, (x, v) => { x.rigid.t = v; }, "Épaisseur de la carte (mm)", 0.1, 0.2)) : null,
      el("p", { class: "muted small" }, d.rigid ? "Montrée pour la place qu'elle prend : sa définition reste celle de la carte, dans l'écran des cartes." : "Le cœur se pose sur la carte, ou sous elle, par son interface IF1.")));
    const g = guideBox(guide(), { title: "Ce que le circuit demande", quiet: "Largeurs, plis et bouts : dans les règles." }); if (g) scroll.append(el("div", { class: "side-section" }, g));
    scroll.append(el("div", { class: "side-section" }, el("h3", null, "Avec une IA"), el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } },
      btn("Copier pour une IA", async () => toast((await copyText(request(store.part(id)))) ? "Copié : la définition du circuit et sa consigne." : "Copie impossible.", "success", 5000), { small: true, icon: "sparkle", tip: "La définition du circuit, précédée de la façon de mener l'entrevue et de la réponse attendue" }),
      btn("Réimporter…", reimport, { small: true, icon: "wizard", tip: "Aperçu des changements, puis une seule étape annulable" }))));
  }
  function card(b, d) {
    const set = (label, fn) => { st.sel = b.id; edit(`${b.id} : ${label}`, fn); }, E = EDGES[b.edge], span = E.along === "W" ? d.core.W : d.core.L, need = widthNeeded(d, b);
    const num = (key, label, step, min, tip) => field(label, el("input", { type: "number", value: key === "tracks" ? tracksOf(b) : b[key], step, min, "data-f": key, "data-tip": tip || null, onChange: (e) => { const v = parseFloat(e.target.value); if (v >= min) set(label, (q) => { q[key] = v; }); } }));
    const net = el("input", { type: "text", value: b.net || "", placeholder: "S1+, HV−…", "data-f": "net", onChange: (e) => set("potentiel", (q) => { q.net = e.target.value.trim(); }) }); if (b.end === "volt" && !b.net) needField(net, { hint: "Le potentiel que cette prise ramène" });
    return el("div", { class: "card taped ft-card", "data-branch-card": b.id },
      el("p", { class: "ft-label" }, "Le bord qu'elle quitte"), tiles("ft-four", Object.keys(EDGES).map((k) => tile({ sel: k === b.edge, color: EDGE_COLOR[k], label: EDGES[k].fr, pic: edgeIcon(k, 40), data: { "data-edge": k }, run: () => set(`bord ${k}`, (q) => { q.edge = k; }) }))),
      el("div", { class: "form-row tight" }, num("at", "Place sur le bord (mm)", 0.5, 0, `Le milieu de la branche, le long du bord — de 0 à ${fr(span)} mm`), num("w", "Largeur (mm)", 0.5, 0.5, `Au moins ${fr(need)} mm pour ses pistes`), num("tracks", "Pistes", 1, 1, "Le nombre de pistes que la branche porte")),
      el("p", { class: "ft-label" }, "Ses parties et ses plis"),
      b.legs.map((g, i) => el("div", { class: "param", style: { gridTemplateColumns: "22px minmax(0,1fr) 132px auto", alignItems: "center" } }, badge(String(i + 1), "neutral"),
        el("input", { type: "number", value: g.L, step: 1, min: 3, "data-f": `leg${i}`, "aria-label": `Longueur de la partie ${i + 1}`, onChange: (e) => { const v = parseFloat(e.target.value); if (v >= 3) set(`partie ${i + 1}`, (q) => { q.legs[i].L = v; }); } }),
        i ? el("select", { "aria-label": `Pli avant la partie ${i + 1}`, onChange: (e) => set(`pli ${i}`, (q) => { q.legs[i].bend = +e.target.value; }) }, FOLDS.map(([v, l]) => el("option", { value: v, selected: v === (g.bend || 90) }, l))) : el("small", { class: "muted" }, "à plat, depuis le cœur"),
        b.legs.length > 1 && i ? el("button", { class: "icon-btn", type: "button", "aria-label": `Retirer la partie ${i + 1}`, onClick: () => set(`partie ${i + 1} retirée`, (q) => { q.legs.splice(i, 1); }) }, "×") : el("span"))),
      el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, FOLDS.map(([v]) => btn(v > 0 ? "Pli vers Z+" : "Pli vers Z−", () => fold(v), { small: true, icon: "plus", tip: `Une partie de plus, après un pli à 90° vers ${v > 0 ? "le haut" : "le bas"}` }))),
      el("p", { class: "ft-label" }, "Ce qu'il y a au bout"), tiles("ft-four", Object.entries(ENDS).map(([k, N]) => tile({ sel: k === b.end, color: END_COLOR[k], label: N.fr, tip: N.text, pic: endIcon(k, 56), data: { "data-end": k }, run: () => set(N.fr.toLowerCase(), (q) => { q.end = k; delete q.tracks; }) }))),
      el("div", { class: "form-row tight" }, b.end === "volt" ? field("Potentiel ramené", net) : null,
        b.end === "volt" ? field("Liaison", el("select", { onChange: (e) => set("liaison", (q) => { q.process = e.target.value; }) }, Object.entries(WELD_PROCESSES).filter(([k]) => k !== "wirebond").map(([k, w]) => el("option", { value: k, selected: k === (b.process || "laser") }, w.fr)))) : null,
        field(b.end === "slot" ? "La fente est dans" : b.end === "free" ? "Va vers" : "Posée sur", el("input", { type: "text", value: b.on || "", placeholder: b.end === "temp" ? "Cellule, busbar, dissipateur…" : b.end === "volt" ? "Busbar, borne de cellule…" : b.end === "slot" ? "Support, capteur…" : "Faisceau, composant…", onChange: (e) => set("destination", (q) => { q.on = e.target.value; }) }))),
      el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, btn(b.side === -1 ? "Bout sur la face du dessous" : "Bout sur la face du dessus", () => set("autre face", (q) => { if (q.side === -1) delete q.side; else q.side = -1; }), { small: true, icon: "layers", tip: "La face de la dernière partie qui porte le capteur ou la prise : l'envoyer de l'autre côté" }),
        btn("Retirer", () => remove(b.id), { small: true, icon: "trash", danger: true })));
  }
  function renderRight() {
    clear(right); const d = def(), c = treeChecks(d);
    right.append(el("div", { class: "side-head" }, el("h2", null, "Branches"), el("a", { class: "btn btn-small", href: `#/parts/${encodeURIComponent(id)}`, "data-tip": "Ouvrir dans le studio de pièce" }, icon("part"))));
    const body = el("div", { class: "side-scroll" }); right.append(body);
    body.append(el("div", { class: "side-section", "data-add-box": "" }, el("h3", null, "Ajouter une branche"), tiles("ft-four", Object.keys(EDGES).map((k) => tile({ color: EDGE_COLOR[k], label: EDGES[k].fr, tip: `Une branche de plus sur le bord ${k}, à la première place libre`, pic: edgeIcon(k), data: { "data-add-edge": k }, run: () => add(k) })))));
    for (const k of Object.keys(EDGES)) {
      const list = d.branches.filter((b) => b.edge === k).sort((a, b) => a.at - b.at); if (!list.length) continue;
      body.append(el("div", { class: "ft-group", style: `--dom:${EDGE_COLOR[k]}`, "data-edge-group": k }, el("div", { class: "lib-group-head" }, edgeIcon(k, 30), el("b", null, `Bord ${k}`), el("small", null, EDGES[k].fr), el("span", { class: "lib-count" }, String(list.length))),
        list.map((b) => { const on = b.id === st.sel, row = c.rows.find((r) => r.id === b.id) || {}, flag = c.notes.find((n) => n.id === b.id);
          return [el("button", { class: `ft-row${on ? " sel" : ""}`, type: "button", "data-branch": b.id, "aria-expanded": on ? "true" : "false", style: `--dom:${END_COLOR[b.end]}`, onClick: () => choose(on ? null : b.id) }, endIcon(b.end, 44), el("span", { class: "ft-name" }, el("b", null, b.id), ` ${ENDS[b.end].fr}${b.end === "volt" && b.net ? ` ${b.net}` : ""}`,
            el("small", null, `à ${fr(b.at, 1)} mm · ${fr(b.w, 1)} mm de large · ${fr(row.length || 0, 0)} mm · ${b.legs.length - 1} pli(s)${b.on ? ` · ${b.on}` : ""}`)), flag ? badge(flag.level === "bad" ? "à corriger" : flag.level === "todo" ? "à entrer" : "à vérifier", flag.level === "bad" ? "danger" : "warn") : null), on ? card(b, d) : null]; })));
    }
    if (!d.branches.length) body.append(el("p", { class: "atelier-hint" }, icon("info"), " Aucune branche : choisissez ci-dessus le bord qu'elle quitte, ou clic droit sur le cœur, dans la vue."));
    if (c.rows.length) body.append(el("div", { class: "side-section" }, el("h3", null, `Ce que l'on obtient — ${c.tracks} piste(s)`), table(["", "Bout", "Pistes", "Large", "Besoin", "Long.", "Plis"], c.rows.map((r) => [r.id, `${ENDS[r.end].fr}${r.end === "volt" && r.net ? ` ${r.net}` : ""}`, String(r.tracks), el("span", { class: r.w < r.need ? "form-error" : "" }, fr(r.w, 1)), fr(r.need, 1), fr(r.length, 0), String(r.folds)])),
      el("p", { class: "muted small" }, `Pistes de signal de 0,3 mm, ${fr(d.gap)} mm entre elles, 0,5 mm au bord du film : environ ${fr(c.rows[0].amps)} A chacune (IPC-2221, piste couverte, échauffement de 20 K). `, el("a", { href: "#/help/sources/elec" }, "Sources"))));
    body.append(el("div", { class: "side-section" }, el("h3", null, "À la souris et au clavier"), el("table", { class: "data" }, el("tbody", null, KEYS.map(([k, t]) => el("tr", null, el("td", null, el("kbd", null, k)), el("td", { style: { fontSize: ".8rem" } }, t)))))));
  }
  const refresh = () => { renderLeft(); renderRight(); setGuide(guide()); };
  const off = store.on("change", () => { const p = store.part(id); if (!p || !isTree(p.flex)) { go("#/flex"); return; } refresh(); build(); });
  refresh(); build();
  return () => { off(); st.token++; setGuide([]); };
}
