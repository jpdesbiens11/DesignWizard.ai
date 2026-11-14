/* DesignWizard.ai — PCBA screen: the design steps — functions, architecture, conceptual layout (zones), detailed
   layout (placement and routing). Each step fills the left panel (what to decide), the centre (what it looks like)
   and the right panel (what the choice implies). */

import { el, icon, btn, badge, field, table, toast, svg, fmt } from "../core/dom.js";
import { store } from "../core/store.js";
import { BLOCKS, BLOCK_CATEGORIES, buildBlock } from "../pcba/blocks.js";
import { addBlock, removeBlock, rebuildBlock, connectPort, renameNet, addFunction, removeFunction } from "../pcba/synth.js";
import { NET_CONVENTION, checkNetName } from "../pcba/netnames.js";
import { CLASSES, COATINGS, FAB, copperLayers, boardBom } from "../pcba/model.js";
import { connectivity, ratsnest } from "../pcba/connect.js";
import { routeStats, clearRoutes } from "../pcba/route.js";
import { stackup } from "../pcba/fabfiles.js";
import { inheritFromPart } from "../pcba/twin.js";
import { boardView, layerList } from "./pcba_view.js";

const num = (value, onChange, step = "any", w = "5.2rem") => el("input", { type: "number", value, step, style: { width: w }, onChange: (e) => { const x = parseFloat(e.target.value); if (Number.isFinite(x)) onChange(x); } });
const txt = (value, onChange, w = "100%") => el("input", { type: "text", value: value ?? "", spellcheck: false, style: { width: w }, onChange: (e) => onChange(e.target.value.trim()) });
const sel = (value, opts, onChange) => el("select", { onChange: (e) => onChange(e.target.value) }, opts.map(([k, l]) => el("option", { value: k, selected: String(k) === String(value) }, l)));
const section = (title, ...kids) => el("div", { class: "side-section" }, el("h3", null, title), ...kids);
const scroll = (side, ...kids) => { const s = el("div", { class: "side-scroll" }, ...kids); side.append(s); return s; };
const hint = (text, kind = "") => el("p", { class: `atelier-hint ${kind}` }, icon(kind === "warn" ? "warning" : "info"), " ", text);
const sevBadge = (s) => badge({ error: "Erreur", warn: "Avertissement", info: "Remarque" }[s], { error: "danger", warn: "warn", info: "neutral" }[s]);
export const ui$ = { num, txt, sel, section, scroll, hint, sevBadge };

/** Runs a long job in the worker and writes its result back as one undoable step. */
export function runJob(ctx, cmd, label, opts, onInfo) {
  const w = new Worker(new URL("../pcba/worker.js", import.meta.url), { type: "module" }), busy = el("div", { class: "pcba-busy" }, el("div", { class: "card" }, icon("refresh"), el("b", null, label), el("span", { class: "muted" }, "…")));
  document.body.append(busy);
  w.onmessage = (e) => {
    const m = e.data;
    if (m.progress) { busy.querySelector("span").textContent = `${m.progress.done} liaison(s) — ${m.progress.net}`; return; }
    w.terminate(); busy.remove();
    if (!m.ok) { toast(m.error, "error"); return; }
    ctx.update((b) => { for (const k of ["blocks", "parts", "tracks", "vias"]) b[k] = m.board[k]; }, label);
    if (onInfo) onInfo(m.info);
  };
  w.onerror = (e) => { w.terminate(); busy.remove(); toast(`Le calcul a échoué : ${e.message || "erreur du module"}.`, "error"); };
  w.postMessage({ id: 1, cmd, board: JSON.parse(JSON.stringify(ctx.board)), opts: opts || {} });
}

/* ---------- 1. functions ---------- */
function fonctions(ctx, { left, view, right }) {
  const { board, ui, rows } = ctx, cur = rows.find((r) => r.id === ui.fn) || null;
  const cat = scroll(left, el("div", { class: "side-head" }, el("h2", null, "Bibliothèque de blocs")), el("p", { class: "muted small" }, cur ? `Un clic ajoute le bloc sous ${cur.id}.` : "Un clic ajoute la fonction et le bloc qui la remplit."));
  for (const c of BLOCK_CATEGORIES) {
    const list = Object.values(BLOCKS).filter((t) => t.category === c); if (!list.length) continue;
    cat.append(section(c, ...list.map((t) => el("button", { type: "button", class: "pcba-pick", "data-tip": t.desc, onClick: () => { let nid; ctx.update((b) => { nid = addBlock(b, t.id, {}, cur && !cur.block && cur.leaf ? { function: cur.id } : cur ? { parent: cur.id } : {}); }, `Bloc ajouté : ${t.name}`); toast(`${t.name} ajouté.`, "success"); } }, icon("plus"), el("span", null, t.name)))));
  }
  const tree = el("div", { class: "pcba-tree" });
  view.append(el("div", { class: "pcba-pane" }, el("div", { class: "pcba-pane-head" }, el("h2", null, "Arbre fonctionnel"), el("span", { class: "grow" }),
    btn("Fonction", () => ctx.update((b) => { ui.fn = addFunction(b, { parent: cur ? cur.id : null, name: "Nouvelle fonction" }); }, "Fonction ajoutée"), { small: true, icon: "plus", tip: cur ? `Ajouter une sous-fonction à ${cur.id}` : "Ajouter une fonction principale" }),
    cur ? btn("Désélectionner", () => { ui.fn = null; ctx.redraw(); }, { small: true }) : null), tree));
  if (!rows.length) tree.append(el("div", { class: "empty" }, el("p", null, "Décrivez ce que la carte doit faire : choisissez un bloc à gauche, ou ajoutez une fonction que vous préciserez ensuite.")));
  for (const r of rows) {
    const f = board.functions.find((x) => x.id === r.id);
    tree.append(el("div", { class: `pcba-fn${r.id === ui.fn ? " sel" : ""}`, style: { marginLeft: `${(r.level - 1) * 1.4}rem` }, onClick: (e) => { if (e.target.closest("input,select,button")) return; ui.fn = r.id === ui.fn ? null : r.id; ctx.redraw(); } },
      el("span", { class: "fn-id" }, r.id), txt(f.name, (v) => ctx.update((b) => { const x = b.functions.find((q) => q.id === r.id); x.name = v || x.name; delete x.auto; }, `${r.id} renommée`)),
      sel(f.kind || "technique", [["principale", "principale"], ["contrainte", "contrainte"], ["technique", "technique"]], (v) => ctx.update((b) => { b.functions.find((q) => q.id === r.id).kind = v; }, `${r.id} : type`)),
      r.block ? badge(`${r.block} · ${r.parts.length} comp.`, "ok") : f.kind === "contrainte" ? badge("à vérifier en revue", "neutral") : r.leaf ? badge("sans solution", "warn") : badge("regroupe", "neutral"),
      el("button", { class: "icon-btn", type: "button", "aria-label": "Retirer", "data-tip": "Retirer la fonction, ses sous-fonctions et leurs blocs", onClick: () => ctx.update((b) => { const gone = [r.id, ...rows.filter((q) => q.id.startsWith(`${r.id}.`)).map((q) => q.id)]; for (const g of gone) { const fn = b.functions.find((q) => q.id === g); if (fn && fn.block) removeBlock(b, fn.block); } removeFunction(b, r.id); if (ui.fn && gone.includes(ui.fn)) ui.fn = null; }, `${r.id} retirée`) }, icon("trash"))));
  }
  const side = scroll(right);
  if (!cur) { side.append(el("div", { class: "side-head" }, el("h2", null, "Fonction")), el("p", { class: "muted" }, "Sélectionnez une fonction pour régler son bloc : paramètres, dimensionnement, raccordements, critères.")); return; }
  const f = board.functions.find((x) => x.id === cur.id), blk = board.blocks.find((x) => x.id === cur.block);
  side.append(el("div", { class: "side-head" }, el("h2", null, `${cur.id} — ${cur.name}`)));
  const crit = section("Critères", ...(f.criteria || []).map((c, i) => el("div", { class: "bc-row" }, txt(c.name, (v) => ctx.update((b) => { b.functions.find((q) => q.id === cur.id).criteria[i].name = v; }), "38%"), txt(c.level, (v) => ctx.update((b) => { b.functions.find((q) => q.id === cur.id).criteria[i].level = v; }), "34%"),
    sel(c.flex || "F1", [["F0", "F0 impératif"], ["F1", "F1 peu négociable"], ["F2", "F2 négociable"], ["F3", "F3 libre"]], (v) => ctx.update((b) => { b.functions.find((q) => q.id === cur.id).criteria[i].flex = v; })),
    el("button", { class: "icon-btn", type: "button", "aria-label": "Retirer le critère", onClick: () => ctx.update((b) => { b.functions.find((q) => q.id === cur.id).criteria.splice(i, 1); }) }, "×"))),
    btn("Critère", () => ctx.update((b) => { const x = b.functions.find((q) => q.id === cur.id); x.criteria = x.criteria || []; x.criteria.push({ name: "Critère", level: "valeur", flex: "F1" }); }, "Critère ajouté"), { small: true, icon: "plus" }));
  side.append(crit);
  if (!blk) { side.append(section("Solution", cur.leaf ? hint("Aucun bloc ne remplit cette fonction : choisissez-en un dans la bibliothèque.", "warn") : el("p", { class: "muted small" }, "Cette fonction regroupe ses sous-fonctions."))); return; }
  const t = BLOCKS[blk.template], built = buildBlock(blk.template, blk.params);
  side.append(section(`Bloc ${blk.id} — ${t.name}`, el("p", { class: "muted small" }, t.desc), ...Object.entries(t.params).map(([k, d]) => field(`${d.label}${d.unit ? ` (${d.unit})` : ""}`,
    d.options ? sel(blk.params[k], d.options.map((o, i) => [o, d.labels ? d.labels[i] : String(o)]), (v) => ctx.update((b) => rebuildBlock(b, blk.id, { ...blk.params, [k]: v }), `${blk.id} : ${d.label}`))
      : d.text ? txt(blk.params[k], (v) => ctx.update((b) => rebuildBlock(b, blk.id, { ...blk.params, [k]: v }), `${blk.id} : ${d.label}`)) : num(blk.params[k], (v) => ctx.update((b) => rebuildBlock(b, blk.id, { ...blk.params, [k]: v }), `${blk.id} : ${d.label}`))))));
  if (built.calc.length) side.append(section("Dimensionnement", el("ol", { class: "calc-steps" }, built.calc.map((c) => el("li", null, el("b", null, `${c.label} : `), c.text)))));
  const ports = Object.entries(built.ports).filter(([, p]) => !p.lazy);
  if (ports.length) side.append(section("Raccordements", ...ports.map(([name, p]) => el("div", { class: "bc-row" }, el("small", { style: { minWidth: "4.2rem" } }, name), txt((blk.connect || {})[name] || p.suggest, (v) => { const c = checkNetName(v); if (!c.ok) { toast(c.hint, "error"); return; } ctx.update((b) => connectPort(b, blk.id, name, v), `${blk.id}.${name} → ${v}`); }, "8.5rem")))));
  side.append(section(`Composants (${cur.parts.length})`, table(["Repère", "Valeur", "Rôle"], board.parts.filter((p) => p.block === blk.id).map((p) => [p.ref, p.value || "—", p.role || ""]))));
  if (built.notes.length) side.append(section("Conseils d'implantation", el("ul", { class: "small" }, built.notes.map((n) => el("li", null, n)))));
}

/* ---------- 2. architecture ---------- */
function blockDiagram(ctx) {
  // one lane per kind of function, from what connects the board to what tests it ; a line per net shared by two blocks
  const { board } = ctx, lanes = BLOCK_CATEGORIES.map((c) => [c, board.blocks.filter((b) => BLOCKS[b.template] && BLOCKS[b.template].category === c)]).filter(([, l]) => l.length), bw = 168, bh = 44, gx = 26, gy = 30, x0 = 104;
  const W = x0 + Math.max(1, ...lanes.map(([, l]) => l.length)) * (bw + gx), H = lanes.length * (bh + gy) + 8, g = svg("svg", { class: "pcba-blocks", viewBox: `0 0 ${W} ${H}`, width: W, height: H }), pos = new Map(), owner = new Map(board.parts.map((p) => [p.ref, p.block]));
  lanes.forEach(([c, l], i) => { g.append(svg("text", { x: 4, y: i * (bh + gy) + 14 + bh / 2 + 4, class: "pb-lane" }, c)); l.forEach((b, j) => pos.set(b.id, [x0 + j * (bw + gx), i * (bh + gy) + 14])); });
  for (const n of board.nets) {
    if (n.class === "ground") continue;
    const bs = [...new Set(n.pins.map((p) => owner.get(p.slice(0, p.indexOf(".")))).filter((x) => pos.has(x)))].sort((a, c) => pos.get(a)[1] - pos.get(c)[1] || pos.get(a)[0] - pos.get(c)[0]);
    for (let i = 1; i < bs.length; i++) { const a = pos.get(bs[i - 1]), c = pos.get(bs[i]), same = Math.abs(a[1] - c[1]) < 1, x1 = a[0] + bw / 2, x2 = c[0] + bw / 2;
      g.append(svg("path", { class: `pb-net ${n.class}${ctx.ui.net === n.name ? " on" : ""}`, d: same ? `M${a[0] + bw},${a[1] + bh / 2} C${a[0] + bw + gx / 2},${a[1] + bh / 2 - 12} ${c[0] - gx / 2},${c[1] + bh / 2 - 12} ${c[0]},${c[1] + bh / 2}` : `M${x1},${a[1] + bh} C${x1},${a[1] + bh + gy * 0.8} ${x2},${c[1] - gy * 0.8} ${x2},${c[1]}` }, svg("title", null, `${n.name}${n.voltage ? ` — ${fmt(n.voltage)} V` : ""}${n.current ? `, ${fmt(n.current)} A` : ""}`))); }
  }
  for (const b of board.blocks) { const p = pos.get(b.id); if (!p) continue; const f = board.functions.find((x) => x.id === b.function), node = svg("g", { class: "pb-block" }, svg("rect", { x: p[0], y: p[1], width: bw, height: bh, rx: 7 }), svg("text", { x: p[0] + 8, y: p[1] + 18, class: "pb-name" }, `${b.id} ${b.name}`.slice(0, 24)), svg("text", { x: p[0] + 8, y: p[1] + 33, class: "pb-fn" }, (f ? f.name : "").slice(0, 31)));
    node.addEventListener("click", () => { ctx.ui.fn = b.function; ctx.nav("fonctions"); }); g.append(node); }
  return g;
}
function architecture(ctx, { left, view, right }) {
  const { board, R, ui } = ctx, bom = boardBom(board, ctx.lib);
  const l = scroll(left, el("div", { class: "side-head" }, el("h2", null, `Nets (${board.nets.length})`)), el("p", { class: "muted small" }, "Le nom dit ce que le cuivre transporte ; la classe, la tension et le courant fixent largeur et isolement."));
  for (const n of R.nets) l.append(el("div", { class: `pcba-net${ui.net === n.name ? " sel" : ""}`, onClick: (e) => { if (e.target.closest("input,select")) return; ui.net = ui.net === n.name ? null : n.name; ctx.redraw(); } },
    txt(n.name, (v) => { const c = checkNetName(v); if (!c.ok) { toast(c.hint, "error"); ctx.redraw(); return; } ctx.update((b) => renameNet(b, n.name, v), `Net ${n.name} → ${v}`); }, "6.6rem"),
    sel(n.class, Object.entries(CLASSES).map(([k, c]) => [k, c.label]), (v) => ctx.update((b) => { b.nets.find((x) => x.name === n.name).class = v; }, `${n.name} : classe`)),
    el("small", { class: "muted" }, `${n.voltage ? `${fmt(n.voltage)} V ` : ""}${n.current ? `${fmt(n.current)} A ` : ""}· ${n.pads.length} br. · ${fmt(n.rules.track)} / ${fmt(n.rules.clearance)}`)));
  l.append(section("Nomenclature des nets", el("ul", { class: "small pcba-conv" }, NET_CONVENTION.map((c) => el("li", null, el("code", null, c.example), " — ", c.meaning)))));
  view.append(el("div", { class: "pcba-pane" }, el("div", { class: "pcba-pane-head" }, el("h2", null, "Schéma par blocs"), el("span", { class: "muted small" }, "Chaque trait est un net qui relie deux blocs ; les masses ne sont pas tracées. Un clic sur un bloc ouvre sa fonction.")), el("div", { class: "pcba-scroll" }, board.blocks.length ? blockDiagram(ctx) : el("div", { class: "empty" }, el("p", null, "Aucun bloc : commencez par les fonctions.")))));
  const r = scroll(right, el("div", { class: "side-head" }, el("h2", null, "Contrôle électrique"), badge(ctx.erc.summary.error ? `${ctx.erc.summary.error} erreur(s)` : "sans erreur", ctx.erc.summary.error ? "danger" : "ok")));
  for (const f of ctx.erc.findings) r.append(el("div", { class: "finding" }, el("span", { class: `sev ${f.severity}` }), el("div", null, el("b", null, `${f.rule} · ${f.title}`), el("p", { class: "small" }, f.message))));
  if (!ctx.erc.findings.length) r.append(el("p", { class: "muted" }, "Rien à signaler."));
  r.append(section("Nomenclature préliminaire", el("div", { class: "kpis" }, el("div", { class: "kpi" }, el("b", null, String(board.parts.length)), el("span", null, "composants")), el("div", { class: "kpi" }, el("b", null, String(bom.length)), el("span", null, "lignes")), el("div", { class: "kpi" }, el("b", null, `${fmt(bom.reduce((s, x) => s + x.total, 0))} $`), el("span", null, "par carte")))));
}

/* ---------- 3. conceptual layout ---------- */
function implantation(ctx, { left, view, right }) {
  const { board, R, ui } = ctx, b = board.board, set = (fn, label) => ctx.update((x) => fn(x.board, x), label || "Carte nue modifiée"), pcbs = store.parts.filter((p) => p.family === "pcb");
  const l = scroll(left, el("div", { class: "side-head" }, el("h2", null, "Carte nue")));
  l.append(section("Contour et fixation", el("div", { class: "form-row" }, field("Largeur (mm)", num(b.size[0], (v) => set((q) => { q.size[0] = v; }))), field("Hauteur (mm)", num(b.size[1], (v) => set((q) => { q.size[1] = v; }))), field("Rayon", num(b.r || 0, (v) => set((q) => { q.r = v; }), "any", "4rem"))),
    pcbs.length ? field("Pièce mécanique liée", sel(board.part || "", [["", "aucune"], ...pcbs.map((p) => [p.id, `${p.id} — ${p.name || ""}`])], (v) => ctx.update((x) => { if (!v) { delete x.part; return; } inheritFromPart(x, store.part(v)); }, "Contour repris de la pièce")), "Le contour, l'épaisseur et les trous de fixation viennent de la pièce.") : null,
    el("p", { class: "muted small" }, `${b.holes.length} trou(s) de fixation${b.holes.length ? ` Ø ${fmt(b.holes[0].d)} mm` : ""}.`),
    el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, btn("Trou", () => set((q) => { q.holes.push({ at: [4, 4], d: 3.2, land: 6, kind: "mount" }); }, "Trou ajouté"), { small: true, icon: "plus" }), b.holes.length && !board.part ? btn("Retirer le dernier", () => set((q) => { q.holes.pop(); }), { small: true }) : null)));
  l.append(section("Empilage et finition", el("div", { class: "form-row" }, field("Couches", sel(b.layers || 2, [[2, "2 couches"], [4, "4 couches"]], (v) => ctx.update((x) => { x.board.layers = +v; clearRoutes(x, { all: true }); const gnd = x.nets.find((n) => n.class === "ground"), rail = x.nets.filter((n) => n.class === "power").sort((p, q) => q.pins.length - p.pins.length)[0]; x.planes = +v === 4 ? [gnd && { net: gnd.name, layer: "in1" }, rail && { net: rail.name, layer: "in2" }].filter(Boolean) : []; }, `${v} couches`))),
    field("Épaisseur", sel(b.t || 1.6, [0.8, 1.0, 1.2, 1.6, 2.0, 2.4].map((t) => [t, `${fmt(t)} mm`]), (v) => set((q) => { q.t = +v; }))), field("Cuivre", sel(b.copper || 35, [[18, "18 µm"], [35, "35 µm"], [70, "70 µm"]], (v) => set((q) => { q.copper = +v; })))),
    el("div", { class: "form-row" }, field("Finition", sel(b.finish || "ENIG", [["ENIG", "ENIG"], ["HASL sans plomb", "HASL sans plomb"], ["Étain chimique", "Étain chimique"]], (v) => set((q) => { q.finish = v; }))), field("Classe", sel((board.rules && board.rules.fab) || "standard", Object.entries(FAB).map(([k, f]) => [k, f.label]), (v) => ctx.update((x) => { x.rules = { ...(x.rules || {}), fab: v }; }, "Classe de fabrication")))),
    (b.layers || 2) === 4 ? el("p", { class: "muted small" }, `Plans : ${(board.planes || []).map((p) => `${p.net} sur ${p.layer === "in1" ? "l'interne 1" : p.layer === "in2" ? "l'interne 2" : p.layer}`).join(", ") || "aucun"}.`) : null));
  l.append(section("Vernis de tropicalisation", el("div", { class: "form-row" }, field("Type", sel((b.coating || {}).type || "none", Object.entries(COATINGS), (v) => set((q) => { q.coating = { thickness: 50, sides: "both", ...(q.coating || {}), type: v }; }, "Vernis"))),
    field("Épaisseur (µm)", num((b.coating || {}).thickness || 50, (v) => set((q) => { q.coating.thickness = v; }), "any", "4.4rem")), field("Faces", sel((b.coating || {}).sides || "both", [["both", "deux faces"], ["top", "dessus"]], (v) => set((q) => { q.coating.sides = v; })))),
    el("p", { class: "muted small" }, "Verni, la carte accepte des isolements plus serrés (IPC-2221B, colonne A5). Connecteurs, points de test et appuis de vis sont épargnés d'office.")));
  l.append(el("div", { class: "form-actions", style: { justifyContent: "flex-start", marginTop: ".8rem" } }, btn("Proposer les zones", () => runJob(ctx, "floorplan", "Implantation conceptuelle", {}, (info) => { for (const n of info.notes || []) toast(n, "warn", 7000); }), { primary: true, icon: "sparkle", tip: "Une zone par bloc : les blocs reliés côte à côte, les connecteurs au bord" })));
  const v = boardView(view);
  v.show({ R, art: ctx.art, board, layers: new Set(["outline", "silk_top"]), zones: true, mode: "zones", ref: null,
    onMoveZone: (id, d, grip) => ctx.update((x) => { const z = x.blocks.find((k) => k.id === id).zone, s = (q) => Math.round(q * 2) / 2; if (grip) { z[2] = Math.max(3, s(z[2] + d[0])); const h = Math.max(3, s(z[3] - d[1])); z[1] = s(z[1] + z[3] - h); z[3] = h; } else { z[0] = s(z[0] + d[0]); z[1] = s(z[1] + d[1]); } }, `Zone ${id} déplacée`) });
  const r = scroll(right, el("div", { class: "side-head" }, el("h2", null, "Implantation conceptuelle"), badge(ctx.zones.length ? `${ctx.zones.length} à régler` : "cohérente", ctx.zones.length ? "warn" : "ok")));
  r.append(el("p", { class: "muted small" }, "Glissez une zone pour la déplacer ; son coin inférieur droit la redimensionne. Chaque bloc restera dans sa zone au placement."));
  for (const z of ctx.zones) r.append(hint(z, "warn"));
  r.append(section("Empilage", table(["Couche", "Matière", "mm"], stackup(board).map((s) => [s.layer, s.material, fmt(s.thickness, 3)]))));
  r.append(section("Classes de nets", table(["Classe", "Piste", "Isolement", "Via"], Object.entries(CLASSES).map(([k, c]) => { const o = ((board.rules || {}).classes || {})[k] || {}; return [c.label, `${fmt(o.track ?? c.track)} mm`, `${fmt(o.clearance ?? c.clearance)} mm`, `${fmt((o.via || c.via)[0])} / ${fmt((o.via || c.via)[1])}`]; }))));
  return () => v.destroy();
}

/* ---------- 4. detailed layout ---------- */
function layout(ctx, { left, view, right }) {
  const { board, R, ui } = ctx, conn = connectivity(R), rats = ratsnest(R, conn), stats = routeStats(board, ctx.lib), unplaced = board.parts.filter((p) => !p.at).length;
  const l = scroll(left, el("div", { class: "side-head" }, el("h2", null, "Layout détaillé")));
  l.append(el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } },
    btn("Placer", () => runJob(ctx, "place", "Placement des composants", { keep: false }, (i) => { toast(i.failed.length ? `${i.failed.length} composant(s) sans place.` : `${i.placed} composants placés.`, i.failed.length ? "warn" : "success"); }), { primary: unplaced > 0, icon: "sparkle", tip: "Place les composants non verrouillés dans la zone de leur bloc" }),
    btn("Router", () => runJob(ctx, "route", "Routage", { maxMs: 60000, passes: 4 }, (i) => toast(i.complete ? `Routage complet : ${Math.round(i.length)} mm, ${i.vias} vias, ${fmt(i.ms / 1000, 1)} s.` : `${i.routed} liaisons sur ${i.total} : ${i.open} à reprendre.`, i.complete ? "success" : "warn", 7000)), { primary: !unplaced && conn.open > 0, icon: "play", disabled: unplaced > 0, tip: "Route toutes les liaisons ouvertes ; le cuivre verrouillé est conservé" }),
    btn("Effacer", () => ctx.update((x) => clearRoutes(x), "Routage effacé"), { small: true, icon: "trash", tip: "Retire le cuivre posé par le routeur" })));
  l.append(el("div", { class: "kpis" }, el("div", { class: "kpi" }, el("b", null, String(conn.open)), el("span", null, "liaisons à router")), el("div", { class: "kpi" }, el("b", null, `${Math.round(stats.length)} mm`), el("span", null, `${stats.tracks} pistes`)), el("div", { class: "kpi" }, el("b", null, String(stats.vias)), el("span", null, "vias"))));
  const v = boardView(view);
  const scene = () => ({ R, art: ctx.art, board, layers: ui.layers, zones: ui.layers.has("zones"), ratsnest: rats, mode: "parts", ref: ui.ref, net: ui.net,
    onPick: (h) => { ui.ref = h.ref || (h.pin ? h.pin.slice(0, h.pin.indexOf(".")) : null); ui.net = h.net || null; ctx.redraw(); },
    onMovePart: (ref, d) => ctx.update((x) => { const p = x.parts.find((q) => q.ref === ref), s = (q) => Math.round(q * 4) / 4; p.at = [s(p.at[0] + d[0]), s(p.at[1] + d[1])]; const nets = x.nets.filter((n) => n.pins.some((pin) => pin.startsWith(`${ref}.`))).map((n) => n.name); clearRoutes(x, { nets }); ui.ref = ref; }, `${ref} déplacé`) });
  v.show(scene());
  l.append(section("Couches", layerList(ctx.art, ui.layers, () => v.show(scene())), el("label", { class: "pv-layer-row" }, el("input", { type: "checkbox", checked: ui.layers.has("zones"), onChange: (e) => { if (e.target.checked) ui.layers.add("zones"); else ui.layers.delete("zones"); v.show(scene()); } }), el("i", { style: { background: "var(--acc)" } }), el("span", null, "Zones des blocs"))));
  l.append(el("p", { class: "muted small" }, "Glissez un composant pour le déplacer : ses pistes sont retirées et ses liaisons redeviennent à router. Molette : zoom. Un clic sur du cuivre montre son net."));
  const r = scroll(right), part = board.parts.find((p) => p.ref === ui.ref), net = R.nets.find((n) => n.name === ui.net);
  if (part) {
    const def = ctx.lib[part.comp] || (board.library || {})[part.comp], edit = (fn, label) => ctx.update((x) => fn(x.parts.find((q) => q.ref === part.ref), x), label || `${part.ref} modifié`);
    r.append(el("div", { class: "side-head" }, el("h2", null, `${part.ref} — ${def ? def.name : part.comp}`)), el("p", { class: "muted small" }, `${part.role || ""}${part.block ? ` · bloc ${part.block}` : ""}`));
    r.append(section("Position", el("div", { class: "form-row" }, field("X", num(part.at ? part.at[0] : 0, (q) => edit((p, x) => { p.at = [q, (p.at || [0, 0])[1]]; clearRoutes(x); }))), field("Y", num(part.at ? part.at[1] : 0, (q) => edit((p, x) => { p.at = [(p.at || [0, 0])[0], q]; clearRoutes(x); }))),
      field("Rotation", sel(part.rot || 0, [[0, "0°"], [90, "90°"], [180, "180°"], [270, "270°"]], (q) => edit((p, x) => { p.rot = +q; clearRoutes(x); }, `${part.ref} tourné`))), field("Face", sel(part.side || "top", [["top", "dessus"], ["bottom", "dessous"]], (q) => edit((p, x) => { p.side = q; clearRoutes(x); })))),
      el("label", { class: "check" }, el("input", { type: "checkbox", checked: !!part.fixed, onChange: (e) => edit((p) => { if (e.target.checked) p.fixed = true; else delete p.fixed; }, `${part.ref} ${e.target.checked ? "verrouillé" : "libéré"}`) }), "Position imposée (verrouillée)")));
    r.append(section("Approvisionnement", field("Valeur", txt(part.value, (q) => edit((p) => { p.value = q; }))), field("Référence du fabricant", txt(part.mpn, (q) => edit((p) => { if (q) p.mpn = q; else delete p.mpn; }))), el("label", { class: "check" }, el("input", { type: "checkbox", checked: !!part.dnp, onChange: (e) => edit((p) => { if (e.target.checked) p.dnp = true; else delete p.dnp; }) }), "Non monté")));
    if (def) r.append(section("Composant", el("p", { class: "small" }, `${def.package} · ${def.desc || ""}`), el("p", { class: "muted small" }, `${def.pads.length} pastilles, ${fmt(def.body[0])} × ${fmt(def.body[1])} × ${fmt(def.body[2])} mm, ${fmt(def.price)} $`)));
  } else if (net) {
    r.append(el("div", { class: "side-head" }, el("h2", null, `Net ${net.name}`), badge(CLASSES[net.class] ? CLASSES[net.class].label : net.class)));
    r.append(el("p", { class: "small" }, `${net.voltage ? `${fmt(net.voltage)} V, ` : ""}${net.current ? `${fmt(net.current)} A, ` : ""}piste de ${fmt(net.rules.track)} mm, isolement de ${fmt(net.rules.clearance)} mm, via ${fmt(net.rules.via[0])} / ${fmt(net.rules.via[1])} mm.`),
      net.rules.need ? el("p", { class: "muted small" }, `IPC-2221 : ${fmt(net.current)} A demandent ${fmt(net.rules.need)} mm de large (35 µm, +10 K).`) : null, table(["Broche", "Nom"], net.pads.map((i) => [R.pads[i].pin, R.pads[i].name])));
  } else r.append(el("div", { class: "side-head" }, el("h2", null, "Sélection")), el("p", { class: "muted" }, "Cliquez un composant ou du cuivre."), section("Longueur par couche", table(["Couche", "mm"], copperLayers(board.board.layers || 2).map((k) => [ctx.art.names[k], fmt(stats.byLayer[k] || 0, 0)]))),
    ...(ctx.placement.length ? [section("Placement", ...ctx.placement.slice(0, 8).map((p) => hint(p.message, "warn")))] : []));
  return () => v.destroy();
}

export const DESIGN_STEPS = { fonctions, architecture, implantation, layout };
