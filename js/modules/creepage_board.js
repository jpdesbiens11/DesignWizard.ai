/* DynamiteOrbit.ai — Isolation of a board ALONE : what the Isolation screen needs when what it analyses is a PCBA and not an assembly
   (demande de JP : « analyser l'isolation du PCBA… analyse PCBA ou analyse Assy »). The scene comes from the real copper of the board
   (pcba/board_iso.js) ; this module gives the screen its menu « Ce que l'on analyse », the potentials of the board, what the analysis
   looks at, and the bodies in the view. Nothing is decided here : the distances are those of the common engine (analysis/cc_paths.js). */

import { productBoards } from "../pcba/board_role.js";
import { el } from "../core/dom.js";
import { go } from "../core/app.js";
import { store } from "../core/store.js";
import { pickList } from "../core/pick_list.js";
import { LIBRARY } from "../pcba/library.js";
import { boardIsoScene } from "../pcba/board_iso.js";
import { material } from "../cad/materials.js";
import { BUILTIN } from "../analysis/cc_rules.js";

const enc = encodeURIComponent;
/* a colour per potential, the highest first : told apart at a glance on the copper ; 0 V is always the same slate */
const LEVEL_COLORS = ["#e5484d", "#f59e0b", "#8b5cf6", "#0ea5e9", "#ec4899", "#14b8a6", "#a16207", "#6366f1"], ZERO = "#64748b";
/** The colour of a potential of a board scene. */
export function levelColor(scene, name) { const hot = scene.levels.filter((l) => l.voltage !== 0), i = hot.findIndex((l) => l.name === name); return i < 0 ? ZERO : LEVEL_COLORS[i % LEVEL_COLORS.length]; }
/** The rules of a pair left at « Functional » on a board : no dielectric test sets its clearance (a choice of the tool, said in the steps
    of the calculation) — two nets of one circuit are never tested one against the other. */
export const BOARD_RULES = { ...BUILTIN, validation: { ...BUILTIN.validation, clearance_covers_hipot: false } };
export const FUNCTIONAL_NOTE = "Functional, sur une carte : aucun essai diélectrique ne fixe la clearance entre deux nets d'un même circuit (choix de l'outil). Si une barrière sépare ces deux potentiels, passez la paire à Basic ou à Reinforced.";

/** The scene of a board, with the laminate of its mechanical twin when it has one. */
export function boardScene(board) {
  const twin = board.part ? store.part(board.part) : null, mat = twin ? material(twin.material) : null, known = !!(mat && mat.cti !== null && mat.cti !== undefined);
  const scene = boardIsoScene(board, LIBRARY, { cti: known ? mat.cti : 175, material: known ? mat.name : "FR4 (supposé)", kinds: (board.isolation || {}).kinds || {} });
  if (!known) scene.notes.unshift({ id: "laminate", text: "Stratifié supposé : FR4, CTI 175 (material group IIIa). La carte n'a pas encore sa pièce (PCB) — c'est là que son matériau se choisit." });
  return scene;
}
/** Puts the bodies of a board scene in a viewer ; what is no longer in the scene goes away. colorOf(body) → a css colour */
export function showBoard(viewer, scene, colorOf) {
  const keep = new Set();
  for (const b of scene.bodies) { viewer.add({ id: b.id, name: b.name, mesh: b.mesh, color: colorOf(b), opacity: 1, data: { body: b.id } }); keep.add(b.id); }
  for (const k of [...viewer.objects.keys()]) if (!keep.has(k)) viewer.remove(k);
}
/** The menu « Ce que l'on analyse » : the boards, then the assemblies — one list, grouped by nature. kind : "board" | "asm" */
export function subjectPicker(kind, id) {
  const groups = [
    { label: "Cartes (PCBA) — une carte seule", color: "#16a34a", items: productBoards(store.project).map((b) => ({ id: `board:${b.id}`, title: b.name || b.id, sub: `${b.id} · son cuivre réel`, icon: "chip" })) },
    { label: "Assemblages — le produit monté", color: "#475569", items: store.assemblies.map((a) => ({ id: `asm:${a.id}`, title: a.name || a.id, sub: `${a.id} · ${(a.instances || []).length} élément(s)`, icon: "assembly" })) },
  ].filter((g) => g.items.length);
  const pick = pickList({ label: "Ce que l'on analyse", value: `${kind}:${id}`, groups, empty: "Ni carte ni assemblage", onPick: (v) => go(v.startsWith("board:") ? `#/creepage/board/${enc(v.slice(6))}` : `#/creepage/${enc(v.slice(4))}`) });
  pick.dataset.isoSubject = kind;
  return pick;
}
/** The potentials of the board : its nets grouped by voltage. save(fn, label) writes in board.isolation */
export function levelsSection(scene, board, save) {
  const sec = el("div", { class: "side-section", "data-box": "iso-levels", "data-fold-note": "les nets de la carte, par tension" }, el("h3", null, "Potentiels de la carte"),
    el("p", { class: "muted", style: { fontSize: ".78rem", margin: "0 0 .4rem" } }, "Les nets viennent du PCBA, regroupés par tension : deux nets à la même tension ne se demandent aucune distance. Une tension se change dans le PCBA. ", el("a", { href: `#/pcba/${enc(board.id)}` }, "Ouvrir le PCBA →")));
  for (const l of scene.levels) {
    const flip = (e) => save((x) => { const k = { ...(x.kinds || {}) }; if (e.target.checked) k[l.name] = "ac"; else delete k[l.name]; x.kinds = k; }, `${l.name} : ${e.target.checked ? "tension alternative" : "tension continue"}`);
    sec.append(el("div", { class: "param iso-level", "data-level": l.name, style: { gridTemplateColumns: "auto minmax(0,1fr) auto auto" } }, el("span", { class: "swatch", style: { background: levelColor(scene, l.name) } }),
      el("label", null, l.name, el("small", null, l.kind === "ac" ? "AC · RMS" : "DC")), el("small", { class: "muted", "data-tip": l.nets.join(", ") }, `${l.nets.length} net${l.nets.length > 1 ? "s" : ""}`),
      el("label", { class: "check", "data-tip": "Tension alternative : la valeur est efficace (RMS), et son pic est plus haut" }, el("input", { type: "checkbox", checked: l.kind === "ac", "aria-label": `${l.name} : tension alternative`, onChange: flip }), "AC")),
      el("p", { class: "muted iso-nets", style: { fontSize: ".74rem", margin: "0 0 .35rem 1.4rem" } }, `${l.nets.slice(0, 6).join(" · ")}${l.nets.length > 6 ? ` … et ${l.nets.length - 6} autre(s)` : ""}`));
  }
  if (scene.levels.length < 2) sec.append(el("p", { class: "form-error", style: { fontSize: ".8rem" } }, "Moins de deux potentiels : rien à comparer. Donnez leur tension aux nets d'alimentation, dans le PCBA."));
  return sec;
}
/** What the analysis of a board looks at, and what it leaves out — said on the screen, not only in the documentation. */
export const scopeSection = (scene) => el("div", { class: "side-section", "data-box": "iso-scope", "data-fold-note": "ce qui est mesuré, ce qui ne l'est pas" }, el("h3", null, "Ce que cette analyse regarde"),
  el("ul", { class: "iso-notes", style: { margin: 0, paddingLeft: "1.1rem", fontSize: ".78rem" } }, scene.notes.map((n) => el("li", { class: n.warn ? "form-error" : "muted", style: { marginBottom: ".3rem" } }, n.text))));
