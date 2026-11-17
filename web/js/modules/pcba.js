/* DesignWizard.ai — PCBA: an electronic board designed from what it must do. The screen follows the natural flow —
   functions, architecture, conceptual layout, preliminary review, detailed layout, checks, fabrication, detailed
   review — drawn as a diagram that shows where the board stands. The views a user of a classic ECAD tool expects
   (schematic, layers, stack-up, rules, net classes, bill of materials, outputs) stay one click away at all times. */

import { el, clear, icon, btn, badge, toast, svg, promptBox, confirmBox } from "../core/dom.js";
import { registerModule, go, setGuide } from "../core/app.js";
import { store } from "../core/store.js";
import { emptyBoard, resolveBoard } from "../pcba/model.js";
import { LIBRARY } from "../pcba/library.js";
import { erc } from "../pcba/erc.js";
import { checkBoard } from "../pcba/drc.js";
import { layerArt } from "../pcba/art.js";
import { zoneProblems, placementProblems } from "../pcba/place.js";
import { functionRows } from "../pcba/synth.js";
import { flowStatus } from "../pcba/status.js";
import { inheritFromPart } from "../pcba/twin.js";
import { demoBoard } from "../demo/demo_pcba.js";
import { DESIGN_STEPS } from "./pcba_steps.js";
import { boardProse } from "../pcba/board_units.js";
import { boardChecksGuide } from "../pcba/guide.js";
import { OUTPUT_STEPS, CLASSIC } from "./pcba_out.js";

const STEPS = { ...DESIGN_STEPS, ...OUTPUT_STEPS };
const ui = { step: null, classic: null, layers: null, ref: null, net: null, fn: null, kind: "PDR", focus: null };
export const pcbaUi = ui;

/** Everything the panels read, computed once per redraw. */
function context(board) {
  const R = resolveBoard(board, LIBRARY), e = erc(board, LIBRARY), drc = checkBoard(board, LIBRARY), zones = zoneProblems(board, LIBRARY), placement = placementProblems(board, LIBRARY);
  return { id: board.id, board, lib: LIBRARY, R, art: layerArt(R, board), erc: e, drc, zones, placement, rows: functionRows(board, LIBRARY), flow: flowStatus(board, { erc: e, zones, placement, drc }), ui,
    update: (fn, label) => store.updateBoard(board.id, fn, label) };
}

/** The flow as a diagram : a box per step, a diamond per review, the state of each, the current one framed. */
function flowDiagram(ctx, onGo) {
  const steps = ctx.flow.steps, W = 1180, bw = 142, gw = 104, gap = (W - steps.reduce((s, x) => s + (x.gate ? gw : bw), 0)) / (steps.length - 1), g = svg("svg", { class: "pcba-flow", viewBox: `0 0 ${W} 78`, role: "img", "aria-label": "Parcours de conception de la carte" });
  let x = 0;
  steps.forEach((s, i) => {
    const w = s.gate ? gw : bw, key = s.gate ? "revue" : s.key, on = ui.step === key && (!s.gate || ui.kind === (s.key === "pdr" ? "PDR" : "CDR")), cx = x + w / 2, detail = boardProse(s.detail || "");
    const node = svg("g", { class: `pf-node ${s.state}${on ? " on" : ""}${s.gate ? " gate" : ""}${ctx.flow.current === s.key ? " here" : ""}`, tabindex: 0, role: "button" }, svg("title", null, boardProse(`${s.label} — ${s.text}`)));
    node.append(s.gate ? svg("polygon", { points: `${cx},4 ${x + w},36 ${cx},68 ${x},36` }) : svg("rect", { x, y: 8, width: w, height: 56, rx: 8 }));
    node.append(svg("text", { x: cx, y: s.gate ? 34 : 31, class: "pf-label" }, s.gate ? "Revue" : `${i + 1 - steps.slice(0, i).filter((q) => q.gate).length}. ${s.label}`), svg("text", { x: cx, y: s.gate ? 46 : 48, class: "pf-detail" }, s.gate ? (s.key === "pdr" ? "préliminaire" : "détaillée") : detail.length > 27 ? `${detail.slice(0, 26)}…` : detail));
    const act = () => { if (s.gate) ui.kind = s.key === "pdr" ? "PDR" : "CDR"; onGo(key); };
    node.addEventListener("click", act); node.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); } });
    g.append(node);
    if (i < steps.length - 1) g.append(svg("path", { class: "pf-arrow", d: `M${x + w + 3},36 H${x + w + gap - 7} m-5,-4 l5,4 l-5,4` }));
    x += w + gap;
  });
  return g;
}

function createFrom(doc) { const id = store.addBoard(doc); ui.step = null; go(`#/pcba/${encodeURIComponent(id)}`); }
function emptyState(main) {
  const pcbs = store.parts.filter((p) => p.family === "pcb");
  main.append(el("div", { class: "page" }, el("div", { class: "empty" }, icon("chip"), el("h2", null, "Aucune carte électronique pour l'instant"),
    el("p", null, "Une carte se conçoit ici à partir de ses fonctions : chaque fonction reçoit un bloc de circuit éprouvé, pris dans la bibliothèque du métier ; l'outil en tire les composants, les nets, l'implantation, le routage, les vérifications et le dossier de fabrication."),
    el("div", { class: "form-actions", style: { justifyContent: "center" } },
      btn("Carte de démonstration", () => createFrom(demoBoard(!!store.part("DRV-CTRL-PCB"))), { primary: true, icon: "sparkle", tip: "Une carte de contrôle complète, de ses fonctions à ses Gerber" }),
      btn("Nouvelle carte", async () => { const name = await promptBox("Nouvelle carte", "Nom de la carte", "Carte de contrôle"); if (name) createFrom(emptyBoard("PCBA-001", name)); }, { icon: "plus" }),
      ...pcbs.map((p) => btn(`À partir de ${p.id}`, () => { const b = emptyBoard(`${p.id}A`, p.name || p.id); inheritFromPart(b, p); createFrom(b); }, { icon: "pcb", tip: "Reprend le contour, l'épaisseur et les trous de fixation de cette pièce" }))))));
}

function render(main, args) {
  if (!store.boards.length) { emptyState(main); return null; }
  const page = el("div", { class: "pcba" }), head = el("div", { class: "pcba-head" }), left = el("aside", { class: "side" }), right = el("aside", { class: "side right" }), view = el("div", { class: "pcba-centre" }), body = el("div", { class: "studio pcba-body" }, left, view, right);
  page.append(head, body); main.append(page);
  let id = args[0] && store.board(args[0]) ? args[0] : store.boards[0].id, dispose = null;
  if (args[1] && (STEPS[args[1]] || CLASSIC[args[1]])) { if (STEPS[args[1]]) { ui.step = args[1]; ui.classic = null; } else ui.classic = args[1]; }
  const draw = () => {
    const board = store.board(id);
    if (!board) { go("#/pcba"); return; }
    const ctx = context(board);
    if (!ui.step || !STEPS[ui.step]) ui.step = ctx.flow.current === "pdr" || ctx.flow.current === "cdr" ? "revue" : ctx.flow.current;
    if (!ui.layers) ui.layers = new Set(["bottom", "in2", "in1", "top", "silk_top", "outline"]);
    const nav = (step) => { ui.step = step; ui.classic = null; ui.focus = null; history.replaceState(null, "", `#/pcba/${encodeURIComponent(id)}/${step}`); draw(); };
    ctx.nav = nav; ctx.redraw = draw;
    setGuide(boardChecksGuide(board, ctx).map((x) => ({ ...x, text: boardProse(x.text), screen: "pcba", ref: id, hash: `#/pcba/${encodeURIComponent(id)}/${x.step}` })));      // what the checks found, for the Guide of the top bar — a board reads in mil
    clear(head);
    head.append(el("div", { class: "pcba-title" }, icon("chip"),
      store.boards.length > 1 ? el("select", { "aria-label": "Carte", onChange: (e) => { ui.ref = ui.net = ui.fn = null; go(`#/pcba/${encodeURIComponent(e.target.value)}`); } }, store.boards.map((b) => el("option", { value: b.id, selected: b.id === id }, `${b.id} — ${b.name || ""}`))) : el("b", null, `${board.id} — ${board.name || ""}`),
      badge(`rév. ${board.revision || "A"}`), el("span", { class: "grow" }),
      btn("", () => createFrom(emptyBoard("PCBA-001", "Nouvelle carte")), { small: true, icon: "plus", tip: "Nouvelle carte" }),
      btn("", async () => { if (await confirmBox("Retirer la carte", `Retirer ${board.id} du projet ?`, "Retirer", true)) { store.removeBoard(id); go("#/pcba"); } }, { small: true, icon: "trash", tip: "Retirer cette carte du projet" })));
    head.append(flowDiagram(ctx, nav));
    const bar = el("div", { class: "pcba-classic" }, el("span", { class: "muted small" }, "Vues classiques :"));
    for (const [key, v] of Object.entries(CLASSIC)) bar.append(el("button", { type: "button", class: `link-btn${ui.classic === key ? " on" : ""}`, "data-tip": v.tip, onClick: () => { if (v.step) { nav(v.step); return; } ui.classic = ui.classic === key ? null : key; draw(); } }, v.label));
    head.append(bar);
    if (dispose) { try { dispose(); } catch (e) { console.error(e); } dispose = null; }
    clear(left); clear(right); clear(view);
    try { dispose = (ui.classic && CLASSIC[ui.classic].render ? CLASSIC[ui.classic].render : STEPS[ui.step])(ctx, { left, view, right }) || null; }
    catch (e) { console.error(e); view.append(el("div", { class: "card" }, el("h3", null, "Cette vue n'a pas pu s'afficher"), el("p", { class: "form-error" }, e.message))); toast(e.message, "error"); }
  };
  const off = store.on("change", () => { if (!store.board(id)) { go("#/pcba"); return; } draw(); });
  draw();
  return () => { off(); if (dispose) dispose(); };
}

registerModule({ key: "pcba", label: "PCBA", icon: "chip", tip: "Carte électronique : des fonctions aux Gerber — bibliothèque du métier, layout conceptuel et détaillé, règles, dossier de fabrication, revue", render });
