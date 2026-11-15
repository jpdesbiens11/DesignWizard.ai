/* DesignWizard.ai — Simulation: a deliberately simple finite-element model for structure and steady-state thermal.
   The part or the assembly is meshed coarsely with identical cubes, the efforts are set on its boundaries (faces and
   interfaces), and BEFORE anything is solved the screen writes the hand calculation of the equivalent simple model —
   what a good analyst does first. The simulation then runs in a worker and is compared with that estimate.
   Route: #/fea or #/fea/<part|assembly id>. Runs kept for the review live in project.simulations. */

import { el, clear, icon, btn, badge, field, table, fmt, toast } from "../core/dom.js";
import { registerModule, setStatus } from "../core/app.js";
import { store } from "../core/store.js";
import { kernel } from "../cad/client.js";
import { createViewport } from "../core/viewport.js";
import { buildAssembly } from "../core/asm_scene.js";
import { props } from "../analysis/physics/props.js";
import { footprint } from "../core/shop_intent.js";
import { patternPoints } from "../cad/interfaces.js";
import { thread } from "../cad/standards.js";
import { buildModel, skin } from "../analysis/fea/index.js";
import { precheckStructure, precheckThermal, precheckThermo, compare } from "../analysis/fea/precheck.js";
import { VERDICT, show } from "../analysis/fea/summary.js";
import { lightSide, sideOf, sidePoints, arrow, clamp, gem, SIDES, LIT } from "../core/view_marks.js";

const FACES = [["-X", "gauche (−X)"], ["+X", "droite (+X)"], ["-Y", "avant (−Y)"], ["+Y", "arrière (+Y)"], ["-Z", "dessous (−Z)"], ["+Z", "dessus (+Z)"]];
const DIRS = { "+X": [1, 0, 0], "-X": [-1, 0, 0], "+Y": [0, 1, 0], "-Y": [0, -1, 0], "+Z": [0, 0, 1], "-Z": [0, 0, -1] };
const st = { target: null, kind: "structure", cells: 3000, fixed: [], loads: [], power: [], fixedT: [], conv: { on: true, h: 10, Tamb: 25 }, thermo: { uniform: true, T: 80, Tref: 20 } };
let seq = 0;

/** Material of a body for the simulation (typical values; the data sheet of the grade prevails). */
export function feaMaterial(id) {
  const p = props(id) || {}, E = p.E ? (p.E < 2000 ? p.E * 1000 : p.E) : 3000;
  return { id: id || "?", name: p.name || id || "matériau inconnu", E, nu: p.nu || 0.33, k: p.k || 0.3, rho: p.rho || 1200, Re: p.Re || null, alpha: (p.cte || 0) * 1e-6, known: !!p.E };
}
/** Blue to red, the way a result plot is read. */
function colour(t) {
  const stops = [[0.05, 0.25, 0.85], [0, 0.75, 0.9], [0.2, 0.78, 0.25], [1, 0.88, 0.1], [0.9, 0.12, 0.1]], x = Math.min(1, Math.max(0, t)) * 4, i = Math.min(3, Math.floor(x)), f = x - i;
  return stops[i].map((c, k) => c + (stops[i + 1][k] - c) * f);
}

function render(main, args) {
  const p = store.project, targets = [...p.parts.map((x) => ({ type: "part", id: x.id, name: x.name || x.id })), ...p.assemblies.map((a) => ({ type: "assembly", id: a.id, name: a.name || a.id }))];
  const left = el("aside", { class: "side" }), right = el("aside", { class: "side right" }), view = el("div"), root = el("div", { class: "studio" }, left, view, right);
  main.append(root);
  if (!targets.length) { root.replaceWith(el("div", { class: "page" }, el("div", { class: "empty" }, el("h2", null, "Rien à simuler"), el("p", null, "Créez d'abord une pièce dans l'Atelier."), el("a", { class: "btn btn-primary", href: "#/shop" }, "Aller à l'Atelier")))); return null; }
  if (args[0] && targets.some((t) => t.id === args[0])) st.target = targets.find((t) => t.id === args[0]);
  if (!st.target || !targets.some((t) => t.id === st.target.id)) { st.target = targets[0]; st.fixed = []; st.loads = []; st.power = []; st.fixedT = []; }
  const vp = createViewport(view, { name: () => `${st.target.id}_simulation`, onPick: (hit) => pickRegion(hit), onHover: (hit) => { if (asking) { vp.viewer.clearOverlays("bchover"); const k = regionAt(hit); if (k) lightRegion(k, LIT.hover, "bchover"); } } }), info = el("span", { class: "chip" }, "—");
  vp.setStatus(info);
  let geo = null, model = null, regions = [], estimate = null, last = null, worker = null, alive = true, asking = null;

  /* ---------- pointing at the part : a face or an interface is chosen in the view, and what is chosen shows ---------- */
  /** The region under a pick : an interface when the point is on one, otherwise the outer face the surface looks at. */
  function regionAt(hit) {
    if (!hit || !model) return null;
    const p = hit.point, h = model.grid.h, b = model.bbox;
    for (const r of regions) if (r.key.startsWith("iface:")) for (const it of r.list) {
      if (it.near && Math.hypot(p[0] - it.near[0], p[1] - it.near[1], p[2] - it.near[2]) <= Math.max(1.5 * it.r, 2 * h)) return r.key;
      if (it.box && [0, 1, 2].every((i) => p[i] >= it.box[i] - h && p[i] <= it.box[3 + i] + h)) return r.key;
    }
    const side = sideOf(hit.normal); if (!side) return null;
    const a = "XYZ".indexOf(side[1]), ext = side[0] === "+" ? b[3 + a] : b[a];
    return Math.abs(p[a] - ext) <= 0.75 * h ? `face:${side}` : null;      // a face region is the outermost plane on that side
  }
  /** Where a region is, as points with their outward direction (for its symbols and its highlight). */
  function spots(key, n = 3) {
    const r = regions.find((x) => x.key === key), out = []; if (!r || !model) return out;
    for (const it of r.list) { if (it.face) out.push(...sidePoints(model.bbox, it.face, n).map((p) => ({ p, out: SIDES[it.face] }))); else if (it.near) out.push({ p: it.near, out: r.n || [0, 0, 1] }); else if (it.box) out.push({ p: [0, 1, 2].map((i) => (it.box[i] + it.box[3 + i]) / 2), out: r.n || [0, 0, 1] }); }
    return out;
  }
  function lightRegion(key, color, tag) {
    if (key.startsWith("face:")) lightSide(vp.viewer, key.slice(5), { tag, color, ids: ["fea"] }); else for (const s of spots(key)) vp.viewer.addMarker(s.p, color, tag, 2.2);
  }
  function pickRegion(hit) {
    if (!asking) return;
    const k = regionAt(hit);
    if (!k) { toast("Cliquez une face extérieure de la pièce (ou une de ses interfaces).", "info", 3000); return; }
    const set = asking; asking = null; view.style.cursor = ""; vp.viewer.clearOverlays("bchover");
    set(k); lightRegion(k, LIT.chosen, "bcpick"); setTimeout(() => { if (alive) vp.viewer.clearOverlays("bcpick"); }, 1400);
  }
  /** The symbols of the load case : clamps where the part is held, arrows where it is pushed and which way, marks for heat. */
  function drawSymbols() {
    const v = vp.viewer; v.clearOverlays("sym"); if (!model) return;
    const tag = "sym", heat = st.kind === "thermal" || (st.kind === "thermo" && !st.thermo.uniform), note = (key, text, cls = "") => { const s = spots(key, 1)[0]; if (s) v.addLabel(s.p, text, tag, cls); };
    if (st.kind !== "thermal") for (const k of st.fixed) for (const s of spots(k)) clamp(v, s.p, s.out, { tag });
    if (st.kind === "structure") for (const l of st.loads) {
      if (l.mode === "pressure") { for (const s of spots(l.region)) arrow(v, s.p, s.out.map((c) => -c), { tag, color: "#f59e0b", len: v._size() * 0.05 }); note(l.region, `${show(l.p, 3)} MPa`); }
      else { for (const s of spots(l.region, 2)) arrow(v, s.p, DIRS[l.dir], { tag, color: "#e5484d" }); note(l.region, `${show(l.F, 1)} N ${l.dir}`, "err"); }
    }
    if (heat) { for (const x of st.power) { for (const s of spots(x.region, 2)) gem(v, s.p, { tag, color: "#f97316" }); note(x.region, `${show(x.P, 1)} W`); } for (const x of st.fixedT) { for (const s of spots(x.region, 2)) gem(v, s.p, { tag, color: "#0ea5e9" }); note(x.region, `${show(x.T, 1)} °C`); } }
  }

  /* ---------- geometry and mesh ---------- */
  async function loadGeometry() {
    vp.setBusy("Construction de la géométrie…"); last = null;
    try {
      if (st.target.type === "part") {
        const built = await kernel.build(store.part(st.target.id));
        geo = { bodies: built.bodies.map((b) => ({ name: b.name, pos: b.mesh.pos, idx: b.mesh.idx, material: feaMaterial(b.material) })), interfaces: built.interfaces, material: store.part(st.target.id).material };
      } else {
        const ctx = await buildAssembly(store.assembly(st.target.id)), bodies = [];
        for (const inst of ctx.asm.instances) for (const b of ctx.built[inst.part].bodies) bodies.push({ name: `${inst.part} · ${b.name}`, pos: b.mesh.pos, idx: b.mesh.idx, matrix: ctx.sol.placements[inst.id], material: feaMaterial(b.material) });
        geo = { bodies, interfaces: [] };
      }
      if (!alive) return;
      remesh(true);
    } catch (e) { vp.setBusy(""); info.textContent = e.message; info.className = "chip bad"; }
  }
  function remesh(first) {
    try { model = buildModel({ bodies: geo.bodies, target: st.cells }); } catch (e) { vp.setBusy(""); info.textContent = e.message; info.className = "chip bad"; model = null; drawRight(); return; }
    const b = model.bbox, h = model.grid.h;
    regions = FACES.map(([k, l]) => ({ key: `face:${k}`, label: `Face ${l}`, list: [{ face: k }] }));
    for (const it of geo.interfaces) {
      const f = it.frame, sign = it.side === "B" ? -1 : 1, at = (pu, pv, pn = 0) => [0, 1, 2].map((i) => f.o[i] + pu * f.u[i] + pv * sign * f.v[i] + pn * f.n[i]);
      if (it.type === "bolt_pattern" || it.type === "pins") {     // held or loaded where the screws are, not over the whole pattern
        const d = it.type === "pins" ? it.params.d : thread(it.params.screw).washer, pts = it.type === "pins" ? Array.from({ length: Math.max(1, Math.round(it.params.n || 2)) }, (_, k, arr) => [(k - (arr.length - 1) / 2) * it.params.pitch, 0]) : patternPoints(it.params.pattern);
        regions.push({ key: `iface:${it.id}`, n: f.n, label: `Interface ${it.id} — ${it.name} (${pts.length} vis)`.replace("vis)", it.type === "pins" ? "goupilles)" : "vis)"), list: pts.map(([pu, pv]) => ({ near: at(pu, pv), r: Math.max(d / 2, 0.75 * h) })) });
      } else {
        const fp = footprint(it, geo.material), pts = [];
        for (const su of [-1, 1]) for (const sv of [-1, 1]) for (const sn of [-1, 1]) pts.push(at(su * fp.w / 2, sv * fp.h / 2, sn * h));
        regions.push({ key: `iface:${it.id}`, n: f.n, label: `Interface ${it.id} — ${it.name}`, list: [{ box: [0, 1, 2].map((i) => Math.min(...pts.map((q) => q[i]))).concat([0, 1, 2].map((i) => Math.max(...pts.map((q) => q[i])))) }] });
      }
    }
    if (!st.fixed.length || !st.fixed.every((k) => regions.some((r) => r.key === k))) {            // a sensible first case: held at one end of the longest side, loaded at the other
      const dims = [b[3] - b[0], b[4] - b[1], b[5] - b[2]], a = dims.indexOf(Math.max(...dims)), ax = "XYZ"[a], iface = regions.find((r) => r.key.startsWith("iface:"));
      st.fixed = [iface ? iface.key : `face:-${ax}`];
      st.loads = [{ region: iface ? `face:${dims[2] <= Math.min(dims[0], dims[1]) ? "+Z" : `+${ax}`}` : `face:+${ax}`, mode: iface && dims[2] <= Math.min(dims[0], dims[1]) ? "pressure" : "force", F: 100, dir: a === 2 ? "-Y" : "-Z", p: 0.002 }];
      st.power = [{ region: "face:-Z", P: 5 }]; st.fixedT = [];
    }
    showMesh(); drawLeft(); refreshEstimate();
    if (first) vp.viewer.view("iso");
    vp.setBusy("");
  }
  function showMesh() {
    const s = skin(model, null), col = new Float32Array(s.pos.length).fill(0.72);
    vp.viewer.clear(); vp.viewer.addField("fea", { pos: s.pos, idx: s.idx, col, epos: s.epos, pickable: true });
    info.textContent = `${model.nCells.toLocaleString("fr-CA")} cubes de ${fmt(model.grid.h, 2)} mm · ${model.nNodes.toLocaleString("fr-CA")} nœuds`; info.className = "chip";
  }
  /** The simple regions of a choice: one for a face, one per screw for a bolted interface (the effort is shared between them). */
  const listOf = (key) => (regions.find((r) => r.key === key) || regions[0]).list;
  function loadCase() {
    if (st.kind === "thermo") return { fixed: st.fixed.flatMap(listOf), loads: [], Tref: st.thermo.Tref, thermal: st.thermo.uniform ? { uniform: st.thermo.T } : { case: thermalCase() } };
    return st.kind === "thermal" ? thermalCase() : structureCase();
  }
  function thermalCase() {
    return { power: st.power.flatMap((x) => listOf(x.region).map((region, i, all) => ({ region, P: x.P / all.length }))), fixedT: st.fixedT.flatMap((x) => listOf(x.region).map((region) => ({ region, T: x.T }))),
      convection: st.conv.on ? [{ region: "exterior", h: st.conv.h, Tamb: st.conv.Tamb }] : [] };
  }
  function structureCase() {
    return { fixed: st.fixed.flatMap(listOf), loads: st.loads.flatMap((l) => listOf(l.region).map((region, i, all) => (l.mode === "pressure" ? { region, pressure: l.p } : { region, force: DIRS[l.dir].map((c) => c * l.F / all.length) }))) };
  }
  function refreshEstimate() {
    if (!model) return;
    const mat = geo.bodies[0].material;
    try { estimate = st.kind === "thermal" ? precheckThermal(model, loadCase(), mat) : st.kind === "thermo" ? precheckThermo(model, loadCase(), mat) : precheckStructure(model, loadCase(), mat); }
    catch (e) { estimate = { kind: "none", title: "Cas incomplet", steps: [e.message], values: {}, warnings: [] }; }
    const v = vp.viewer; v.clearOverlays("bc");
    if (estimate.where) v.addMarker(estimate.where, "#0c66e4", "bc", 1.6);
    if (estimate.at && estimate.where) v.addPath([estimate.where, estimate.at], "#ff5a4f", "bc", 0.6, true);
    drawSymbols(); drawRight();
  }

  /* ---------- left: what is simulated and how it is held and loaded ---------- */
  const sel = (value, opts, onChange) => el("select", { onChange: (e) => onChange(e.target.value) }, opts.map(([k, l]) => el("option", { value: k, selected: k === value }, l)));
  const num = (value, onChange, step = "any") => el("input", { type: "number", value, step, onChange: (e) => { const x = parseFloat(e.target.value); if (Number.isFinite(x)) onChange(x); } });
  const regSel = (value, onChange) => {
    const s = sel(value, regions.map((r) => [r.key, r.label]), onChange), aim = el("button", { class: "icon-btn", type: "button", "aria-label": "Choisir dans la vue", "data-tip": "Choisir à la souris : cliquez la face (ou l'interface) dans la vue 3D", onClick: () => { asking = onChange; view.style.cursor = "crosshair"; toast("Cliquez une face extérieure de la pièce : elle s'allume sous le curseur.", "info", 3000); } }, icon("fit"));
    const row = el("span", { class: "bc-pick", onMouseenter: () => { vp.viewer.clearOverlays("bchover"); lightRegion(s.value, LIT.named, "bchover"); }, onMouseleave: () => { if (!asking) vp.viewer.clearOverlays("bchover"); } }, s, aim);
    return row;
  };
  const changed = () => { last = null; showMesh(); drawLeft(); refreshEstimate(); };
  const rm = (list, i) => el("button", { class: "icon-btn", type: "button", "aria-label": "Retirer", onClick: () => { list.splice(i, 1); changed(); } }, "×");
  function drawLeft() {
    clear(left);
    left.append(el("img", { class: "side-mark", src: "img/marks/physique.svg", alt: "" }), el("div", { class: "side-head" }, el("h2", null, "Simulation")));
    const scroll = el("div", { class: "side-scroll" });
    left.append(scroll);
    scroll.append(el("div", { class: "subtabs" }, el("a", { class: "subtab", href: "#/physics" }, "Modèles analytiques"), el("a", { class: "subtab active", href: "#/fea" }, "Simulation")),
      el("div", { class: "side-section" }, field("Ce que l'on simule", sel(st.target.id, targets.map((t) => [t.id, `${t.type === "part" ? "Pièce" : "Assemblage"} — ${t.name}`]), (id) => { st.target = targets.find((t) => t.id === id); st.fixed = []; loadGeometry(); })),
        field("Physique", sel(st.kind, [["structure", "Structure — efforts et déformations"], ["thermal", "Thermique — régime permanent"], ["thermo", "Thermo-mécanique — dilatation et contraintes"]], (k) => { st.kind = k; changed(); })),
        field("Finesse du maillage", el("input", { type: "range", min: 500, max: 16000, step: 500, value: st.cells, onChange: (e) => { st.cells = +e.target.value; last = null; remesh(false); } }), `Environ ${st.cells.toLocaleString("fr-CA")} cubes : grossier et rapide. Les détails plus petits qu'un cube sont ignorés.`)));
    const sec = el("div", { class: "side-section" });
    scroll.append(sec);
    const heat = st.kind === "thermal" || (st.kind === "thermo" && !st.thermo.uniform);
    if (st.kind !== "thermal") {
      sec.append(el("h3", null, el("span", { class: "grow" }, "Appuis (encastrés)"), btn("", () => { st.fixed.push(regions[0].key); changed(); }, { small: true, icon: "plus", tip: "Ajouter un appui" })));
      st.fixed.forEach((k, i) => sec.append(el("div", { class: "bc-row" }, regSel(k, (v) => { st.fixed[i] = v; changed(); }), st.fixed.length > 1 ? rm(st.fixed, i) : null)));
      sec.append(el("p", { class: "muted small" }, "Chaque appui et chaque effort se choisit dans la liste ou à la souris (bouton cible) ; son symbole apparaît sur la pièce : cônes bleus = encastrement, flèches rouges = force et son sens, flèches orange = pression."));
      if (st.kind === "thermo") sec.append(el("h3", { style: { marginTop: ".7rem" } }, "Température"),
        el("div", { class: "bc-row" }, el("small", null, "Montage sans contrainte à"), num(st.thermo.Tref, (v) => { st.thermo.Tref = v; changed(); }), el("small", null, "°C")),
        el("label", { class: "check" }, el("input", { type: "checkbox", checked: st.thermo.uniform, onChange: (e) => { st.thermo.uniform = e.target.checked; changed(); } }), "Pièce à température uniforme"),
        st.thermo.uniform ? el("div", { class: "bc-row" }, num(st.thermo.T, (v) => { st.thermo.T = v; changed(); }), el("small", null, "°C en service")) : el("p", { class: "muted small" }, "Le champ de température est d'abord calculé avec les sources ci-dessous, puis appliqué à la structure."));
      if (st.kind === "structure") sec.append(el("h3", { style: { marginTop: ".7rem" } }, el("span", { class: "grow" }, "Efforts"), btn("", () => { st.loads.push({ region: regions[1].key, mode: "force", F: 100, dir: "-Z", p: 0.1 }); changed(); }, { small: true, icon: "plus", tip: "Ajouter un effort" })));
      if (st.kind === "structure") st.loads.forEach((l, i) => sec.append(el("div", { class: "bc-card" }, el("div", { class: "bc-row" }, regSel(l.region, (v) => { l.region = v; changed(); }), rm(st.loads, i)),
        el("div", { class: "bc-row" }, sel(l.mode, [["force", "Force (N)"], ["pressure", "Pression (MPa)"]], (v) => { l.mode = v; changed(); }),
          l.mode === "force" ? num(l.F, (v) => { l.F = v; changed(); }) : num(l.p, (v) => { l.p = v; changed(); }),
          l.mode === "force" ? sel(l.dir, Object.keys(DIRS).map((d) => [d, `vers ${d}`]), (v) => { l.dir = v; changed(); }) : null))));
    }
    if (heat) {
      sec.append(el("h3", { style: st.kind === "thermo" ? { marginTop: ".7rem" } : null }, el("span", { class: "grow" }, "Sources de chaleur"), btn("", () => { st.power.push({ region: regions[0].key, P: 5 }); changed(); }, { small: true, icon: "plus", tip: "Ajouter une source" })));
      st.power.forEach((x, i) => sec.append(el("div", { class: "bc-row" }, regSel(x.region, (v) => { x.region = v; changed(); }), num(x.P, (v) => { x.P = v; changed(); }), el("small", null, "W"), st.power.length > 1 ? rm(st.power, i) : null)));
      sec.append(el("h3", { style: { marginTop: ".7rem" } }, el("span", { class: "grow" }, "Températures imposées"), btn("", () => { st.fixedT.push({ region: regions[5].key, T: 25 }); changed(); }, { small: true, icon: "plus", tip: "Ajouter une face tenue en température" })));
      st.fixedT.forEach((x, i) => sec.append(el("div", { class: "bc-row" }, regSel(x.region, (v) => { x.region = v; changed(); }), num(x.T, (v) => { x.T = v; changed(); }), el("small", null, "°C"), rm(st.fixedT, i))));
      sec.append(el("h3", { style: { marginTop: ".7rem" } }, "Convection sur l'extérieur"), el("label", { class: "check" }, el("input", { type: "checkbox", checked: st.conv.on, onChange: (e) => { st.conv.on = e.target.checked; changed(); } }), "Toutes les faces exposées"),
        st.conv.on ? el("div", { class: "bc-row" }, num(st.conv.h, (v) => { st.conv.h = v; changed(); }), el("small", null, "W/m²·K"), num(st.conv.Tamb, (v) => { st.conv.Tamb = v; changed(); }), el("small", null, "°C")) : null,
        el("p", { class: "muted small" }, "Air calme : 5 à 15 W/m²·K ; air soufflé : 25 à 100 ; plaque froide à eau : 500 et plus."));
    }
    const m = geo.bodies[0].material;
    scroll.append(el("div", { class: "side-section" }, el("h3", null, "Matériau"), el("p", { class: "small" }, geo.bodies.length > 1 ? `${geo.bodies.length} corps, chacun avec son matériau ; contacts collés, conduction parfaite.` : `${m.name} — E ${fmt(m.E / 1000, 1)} GPa, ν ${m.nu}, k ${fmt(m.k, 1)} W/m·K${m.alpha ? `, α ${fmt(m.alpha * 1e6, 1)} µm/m·K` : ""}${m.Re ? `, Re ${fmt(m.Re, 0)} MPa` : ""}.`),
      el("p", { class: "muted small" }, "Valeurs typiques : la fiche de la nuance fait foi.")));
  }

  /* ---------- right: the hand calculation first, then the simulation ---------- */
  function drawRight() {
    clear(right);
    right.append(el("div", { class: "side-head" }, el("h2", null, st.target.name)));
    const body = el("div", { class: "side-scroll" });
    right.append(body);
    if (!model || !estimate) { body.append(el("p", { class: "muted" }, "Préparation…")); return; }
    body.append(el("div", { class: "side-section" }, el("h3", null, "1. Avant de calculer — l'estimation à la main"), el("p", { class: "small" }, el("b", null, estimate.title)),
      el("ol", { class: "calc-steps" }, estimate.steps.map((s) => el("li", null, s))), ...estimate.warnings.map((w) => el("p", { class: "atelier-hint warn" }, icon("warning"), " ", w))));
    const go = btn(last ? "Relancer la simulation" : "Lancer la simulation", () => run(), { primary: true, icon: "play" });
    body.append(el("div", { class: "side-section" }, el("h3", null, "2. La simulation"), el("p", { class: "muted small" }, "Cubes identiques, hexaèdre à modes incompatibles (flexion juste même avec un élément dans l'épaisseur), gradient conjugué. Tout le code du solveur est dans ce dépôt, sous licence MIT."),
      el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, go)));
    if (!last) return;
    const r = last.result, c = last.compare, mat = geo.bodies[0].material, sf = st.kind !== "thermal" && mat.Re ? mat.Re / r.maxVm.value : null;
    body.append(el("div", { class: "kpis" }, ...(st.kind === "thermal"
      ? [el("div", { class: "kpi" }, el("b", null, `${show(r.maxT.value, 1)} °C`), el("span", null, "Température maximale")), el("div", { class: "kpi" }, el("b", null, `${show(r.minT.value, 1)} °C`), el("span", null, "Température minimale")), el("div", { class: "kpi" }, el("b", null, `${show(r.balance.out, 2)} W`), el("span", null, `évacués sur ${show(r.balance.in, 2)} W`))]
      : [el("div", { class: "kpi" }, el("b", null, `${show(r.maxVm.value, 1)} MPa`), el("span", null, `Contrainte de pointe${r.nominalVm ? ` · nominale ${show(r.nominalVm.value, 1)}` : ""}`)), el("div", { class: "kpi" }, el("b", null, `${show(r.maxU.value)} mm`), el("span", null, "Déplacement maximal")), el("div", { class: "kpi" }, el("b", null, sf ? show(sf, 2) : "—"), el("span", null, "Marge Re / σ de pointe")),
        ...(st.kind === "thermo" ? [el("div", { class: "kpi" }, el("b", null, `${show(r.maxT.value, 1)} °C`), el("span", null, r.minT.value === r.maxT.value ? "Température uniforme" : `Température, de ${show(r.minT.value, 1)} °C`))] : [])])));
    const unit = st.kind === "thermal" ? "°C" : "MPa", [d0, d1] = last.data, span = (d1 - d0) || 1, clampV = (x) => Math.min(d1, Math.max(d0, x));
    const lo = el("input", { type: "number", step: "any", value: +last.range[0].toPrecision(4), "aria-label": "Bas de l'échelle" }), hi = el("input", { type: "number", step: "any", value: +last.range[1].toPrecision(4), "aria-label": "Haut de l'échelle" });
    const sLo = el("input", { type: "range", min: 0, max: 1000, value: Math.round(1000 * (last.range[0] - d0) / span), "aria-label": "Bas de l'échelle (curseur)" }), sHi = el("input", { type: "range", min: 0, max: 1000, value: Math.round(1000 * (last.range[1] - d0) / span), "aria-label": "Haut de l'échelle (curseur)" });
    const out = el("p", { class: "muted small" }), tell = () => { out.textContent = last.range[0] > d0 || last.range[1] < d1 ? `Résultat de ${show(d0, 1)} à ${show(d1, 1)} ${unit}. Hors échelle : au-dessus en magenta, en dessous en gris.` : `Échelle automatique : tout le résultat, de ${show(d0, 1)} à ${show(d1, 1)} ${unit}.`; };
    const setRange = (a, b, from) => { if (!(b > a)) return; last.range = [a, b]; st.scale = a <= d0 && b >= d1 ? null : [a, b]; if (from !== "n") { lo.value = +a.toPrecision(4); hi.value = +b.toPrecision(4); } if (from !== "s") { sLo.value = Math.round(1000 * (clampV(a) - d0) / span); sHi.value = Math.round(1000 * (clampV(b) - d0) / span); } paint(); tell(); };
    lo.addEventListener("input", () => setRange(parseFloat(lo.value), last.range[1], "n")); hi.addEventListener("input", () => setRange(last.range[0], parseFloat(hi.value), "n"));
    sLo.addEventListener("input", () => setRange(d0 + span * Math.min(+sLo.value, +sHi.value - 5) / 1000, last.range[1], "s")); sHi.addEventListener("input", () => setRange(last.range[0], d0 + span * Math.max(+sHi.value, +sLo.value + 5) / 1000, "s"));
    tell();
    body.append(el("div", { class: "side-section" }, el("h3", null, el("span", { class: "grow" }, `Échelle des couleurs (${unit})`), btn("Auto", () => setRange(d0, d1), { small: true, icon: "refresh", tip: "Revenir à l'échelle qui couvre tout le résultat" })),
      el("div", { class: "fea-legend" }, lo, el("i"), hi), el("div", { class: "fea-scale" }, sLo, sHi), out,
      st.kind !== "thermal" ? el("p", { class: "muted small" }, `Déformée amplifiée ${fmt(r.scale, 0)} fois.`) : null));
    body.append(el("div", { class: "side-section" }, el("h3", null, "3. Le recoupement ", badge(VERDICT[c.verdict][0], VERDICT[c.verdict][1])),
      c.rows.length ? table(["", "À la main", "Simulation", "Écart"], c.rows.map((x) => [x.label, x.low !== undefined ? `${show(x.low, 2)} à ${show(x.analytic, 2)} ${x.unit}` : `${x.bound ? "au plus " : ""}${show(x.analytic, 2)} ${x.unit}`, `${show(x.fea, 2)} ${x.unit}`, x.deviation === null ? "—" : x.low !== undefined && x.deviation === 0 ? "dans la fourchette" : x.bound && x.deviation === 0 ? `sous la borne${x.note ? ` (${x.note})` : ""}` : `${x.deviation > 0 ? "+" : ""}${Math.round(x.deviation * 100)} %`])) : null,
      el("p", { class: "small" }, c.text), ...(c.notes || []).map((t) => el("p", { class: "atelier-hint warn" }, icon("warning"), " ", t)),
      last.info.dropped && last.info.dropped.length ? el("p", { class: "atelier-hint" }, icon("info"), ` ${last.info.dropped.length} corps laissé(s) de côté, car le maillage grossier ne les relie à aucune pièce tenue : ${last.info.dropped.slice(0, 6).join(", ")}${last.info.dropped.length > 6 ? "…" : ""}.`) : null,
      el("p", { class: "muted small" }, `${last.info.cells.toLocaleString("fr-CA")} cubes, ${r.dofs.toLocaleString("fr-CA")} inconnues, ${r.iterations} itérations, ${fmt(r.ms / 1000, 2)} s. La contrainte de pointe d'un maillage grossier est indicative : les concentrations locales (trous, congés, bord de l'encastrement) ne sont pas résolues.`),
      el("div", { class: "form-actions" }, btn("Ajouter au rapport", () => keep(), { small: true, icon: "plus" }))));
  }
  /** Paints the result with the current range of the colour scale : blue to red inside, magenta above, grey below. */
  function paint() {
    if (!last || !last.skin) return;
    const s = last.skin, [a, b] = last.range, col = new Float32Array(s.pos.length);
    for (let i = 0; i < s.val.length; i++) { const x = s.val[i], c = x > b * (1 + 1e-9) + 1e-12 ? [0.85, 0.27, 0.94] : x < a - 1e-9 * Math.abs(a) - 1e-12 ? [0.62, 0.64, 0.68] : colour((x - a) / (b - a)); col[3 * i] = c[0]; col[3 * i + 1] = c[1]; col[3 * i + 2] = c[2]; }
    vp.viewer.addField("fea", { pos: s.pos, idx: s.idx, col, epos: s.epos, pickable: true });
  }
  function run() {
    if (!model) return;
    if (worker) worker.terminate();
    worker = new Worker(new URL("../analysis/fea/worker.js", import.meta.url), { type: "module" });
    const id = ++seq, kind = st.kind, est = estimate;
    vp.setBusy("Résolution…"); setStatus("Simulation en cours…", "busy");
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.id !== id || !alive) return;
      if (m.progress !== undefined) { vp.setBusy(`Résolution… itération ${m.progress.iteration || ""}`); return; }
      vp.setBusy(""); worker.terminate(); worker = null;
      if (!m.ok) { setStatus("Simulation impossible", "bad"); toast(m.error, "error", 9000); return; }
      const s = m.skin, lo = kind === "thermal" ? m.result.minT.value : 0, hi = kind === "thermal" ? m.result.maxT.value : m.result.maxVm.value;
      last = { skin: s, data: [lo, hi > lo ? hi : lo + 1], range: [lo, hi > lo ? hi : lo + 1] }; st.scale = null; paint();
      const peak = kind === "thermal" ? m.result.maxT : m.result.maxVm;
      vp.viewer.clearOverlays("bc"); vp.viewer.addMarker(peak.at, "#ff5a4f", "bc", 1.8); vp.viewer.addLabel(peak.at, kind === "thermal" ? `${show(peak.value, 1)} °C` : `${show(peak.value, 1)} MPa`, "bc", "err");
      Object.assign(last, { result: m.result, info: m.info, compare: compare(kind, est, m.result), estimate: est });
      setStatus(`Simulation : ${m.result.iterations} itérations, ${fmt(m.result.ms / 1000, 2)} s`, "done");
      drawRight();
    };
    worker.onerror = (e) => { vp.setBusy(""); setStatus("Simulation impossible", "bad"); toast(`Le solveur s'est arrêté : ${e.message || "erreur inconnue"}.`, "error", 9000); };
    worker.postMessage({ id, kind, bodies: geo.bodies, mesh: { target: st.cells }, load: loadCase() });
  }
  function keep() {
    if (!last) return;
    const r = last.result, mat = geo.bodies[0].material, thermal = st.kind === "thermal", nominal = r.nominalVm ? r.nominalVm.value : null;
    store.commit(`Simulation gardée : ${st.target.id}`, (x) => { x.simulations = x.simulations || []; x.simulations.push({ id: `S${x.simulations.length + 1}`, kind: st.kind, target: st.target.id, cells: last.info.cells, h: last.info.h,
      estimate: thermal ? { Tmax: last.estimate.values.Tmax } : { sigma: (st.kind === "thermo" && last.estimate.values.sigmaPlate) || last.estimate.values.sigma, delta: last.estimate.values.delta },
      result: thermal ? { Tmax: r.maxT.value, Tmin: r.minT.value } : { sigma: r.maxVm.value, nominal, delta: r.maxU.value, sf: mat.Re ? mat.Re / r.maxVm.value : null, ...(st.kind === "thermo" ? { Tmax: r.maxT.value, core: r.coreVm ? r.coreVm.value : null } : {}) },
      worst: last.compare.rows.length ? last.compare.worst : null, verdict: last.compare.verdict, when: new Date().toISOString() }); });
    toast("Simulation ajoutée au rapport de revue.", "success");
  }

  loadGeometry();
  return () => { alive = false; if (worker) worker.terminate(); vp.dispose(); };
}

registerModule({ key: "fea", label: "Simulation", icon: "physics", hidden: true, tip: "Éléments finis simplifiés, structure et thermique, recoupés par un calcul à la main", render });
