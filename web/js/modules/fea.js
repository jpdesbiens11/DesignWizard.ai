/* DesignWizard.ai — Simulation: a deliberately simple finite-element model for structure and steady-state thermal.
   The part or the assembly is meshed coarsely with identical cubes, the efforts are set on its boundaries (faces and
   interfaces), and BEFORE anything is solved the screen writes the hand calculation of the equivalent simple model —
   what a good analyst does first. The simulation then runs in a worker and is compared with that estimate.
   Route: #/fea or #/fea/<part|assembly id>. Runs kept for the review live in project.simulations. */

import { el, clear, icon, btn, badge, field, table, fmt, toast, confirmBox } from "../core/dom.js";
import { registerModule, setStatus, setGuide } from "../core/app.js";
import { store } from "../core/store.js";
import { kernel } from "../cad/client.js";
import { createViewport } from "../core/viewport.js";
import { buildAssembly } from "../core/asm_scene.js";
import { props } from "../analysis/physics/props.js";
import { footprint } from "../core/shop_intent.js";
import { patternPoints } from "../cad/interfaces.js";
import { thread } from "../cad/standards.js";
import { buildModel, skin, regionInfo } from "../analysis/fea/index.js";
import { findSymmetries, reduceModel, loadSymmetry, oneSymmetry } from "../analysis/fea/symmetry.js";
import { cutsSection, cutMenu, fraction } from "./fea_cuts.js";
import { precheckStructure, precheckThermal, precheckThermo, compare } from "../analysis/fea/precheck.js";
import { VERDICT, show } from "../analysis/fea/summary.js";
import { lightSide, lightTriangles, sideOf, sidePoints, arrow, clamp, gem, SIDES, LIT } from "../core/view_marks.js";
import { patchAt, patchKey, parsePatchKey, patchInfo, patchSpots, patchFlags } from "../analysis/fea/patch.js";
import { caseIssues, blocking } from "../analysis/fea/case_check.js";
import { guideBox, guideSummary, nudge } from "../core/guide.js";
import { bcTree, bcFind, bcLabels, BC_COLORS } from "../analysis/fea/bc_tree.js";
import { bcSection } from "./fea_tree.js";
import { viewSwitch, resultPanel } from "./fea_result.js";
import { safetyField, safetySummary, fsColour } from "../analysis/fea/safety.js";

const FACES = [["-X", "gauche (−X)"], ["+X", "droite (+X)"], ["-Y", "avant (−Y)"], ["+Y", "arrière (+Y)"], ["-Z", "dessous (−Z)"], ["+Z", "dessus (+Z)"]];
const TOWARD = { "-X": "la gauche (−X)", "+X": "la droite (+X)", "-Y": "l'avant (−Y)", "+Y": "l'arrière (+Y)", "-Z": "le bas (−Z)", "+Z": "le haut (+Z)" };
const DIRS = { "+X": [1, 0, 0], "-X": [-1, 0, 0], "+Y": [0, 1, 0], "-Y": [0, -1, 0], "+Z": [0, 0, 1], "-Z": [0, 0, -1] };
const st = { target: null, kind: "structure", cells: 3000, cuts: [], fixed: [], loads: [], power: [], fixedT: [], conv: { on: true, h: 10, Tamb: 25 }, thermo: { uniform: true, T: 80, Tref: 20 }, sel: null, show: {}, view: "model", quantity: "stress", fsTarget: 1.5 };      // sel : the item of the load case that is selected (A1, E2…) ; show : the labels of a type, on or off ; view : the model with its conditions, or the last result ; quantity : what the colours of a result show (stress or safety factor, against fsTarget)
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
  if (!st.target || !targets.some((t) => t.id === st.target.id)) { st.target = targets[0]; st.fixed = []; st.loads = []; st.power = []; st.fixedT = []; st.cuts = []; st.sel = null; }
  const vp = createViewport(view, { name: () => `${st.target.id}_simulation`, menuFor: (hit) => { if (st.view === "result") return [{ title: `Résultat ${last ? last.n : ""} affiché` }, { label: "Revenir au modèle pour modifier le cas", icon: "edit", run: () => setView("model") }];
      const own = regionMenu(hit), cut = whole ? cutMenu(hit, st, () => { outdate(); remesh(false); }) : []; return [...own, ...(own.length && cut.length ? ["—"] : []), ...cut]; }, onPick: (hit) => { if (!asking) return false; pickRegion(hit); return true; }, onHover: (hit) => { if (asking) { vp.viewer.clearOverlays("bchover"); const k = regionAt(hit); if (k) lightRegion(k, LIT.hover, "bchover"); } } }), info = el("span", { class: "chip" }, "—");
  let geo = null, model = null, whole = null, syms = [], regions = [], estimate = null, last = null, runs = [], worker = null, alive = true, asking = null;      // whole : the product entire ; model : what is solved — the same, or what the cuts keep

  /* ---------- pointing at the part : a face or an interface is chosen in the view, and what is chosen shows ---------- */
  /* a face the designer pointed at — an inner wall, a floor, a step — is a region too : its key finds it again on every mesh */
  const patches = new Map();
  function patchRegion(key) {
    if (patches.has(key)) return patches.get(key);
    const p = parsePatchKey(key); if (!p || !whole) return null;
    const i = patchInfo(whole, p), r = { key, patch: p, n: SIDES[p.dir], gone: !i, list: [{ patch: p }],
      label: i ? `Face pointée, tournée vers ${TOWARD[p.dir]}${i.level !== null ? ` — ${"xyz"["XYZ".indexOf(p.dir[1])]} = ${fmt(i.level, 1)} mm` : ""}, ${fmt(i.area / 100, 1)} cm²` : "Face pointée — introuvable sur ce maillage" };
    patches.set(key, r); return r;
  }
  const regionOf = (key) => regions.find((r) => r.key === key) || patchRegion(key);
  const usedPatches = () => [...new Set([...st.fixed, ...st.loads.map((x) => x.region), ...st.power.map((x) => x.region), ...st.fixedT.map((x) => x.region)].filter((k) => String(k).startsWith("patch:")))].map(patchRegion).filter(Boolean);
  /** The region under a pick : an interface when the point is on one ; the whole side of the product when the point is on its
      outermost plane ; otherwise the face pointed at, whatever it is — inside a housing, under a cover, at the bottom of a pocket. */
  function regionAt(hit) {
    if (!hit || !model || st.view === "result") return null;      // a result is looked at ; the case is changed on the model
    const p = hit.point, h = model.grid.h, b = whole.bbox;      // a face of the product, not the face of a cut
    for (const r of regions) if (r.key.startsWith("iface:")) for (const it of r.list) {
      if (it.near && Math.hypot(p[0] - it.near[0], p[1] - it.near[1], p[2] - it.near[2]) <= Math.max(1.5 * it.r, 2 * h)) return r.key;
      /* a plane interface is its own face : a wall beside it, though inside its box on a thin part, is not the interface */
      if (it.box && (!r.n || !hit.normal || Math.abs(hit.normal[0] * r.n[0] + hit.normal[1] * r.n[1] + hit.normal[2] * r.n[2]) > 0.7) && [0, 1, 2].every((i) => p[i] >= it.box[i] - h && p[i] <= it.box[3 + i] + h)) return r.key;
    }
    const side = sideOf(hit.normal); if (!side) return null;
    const a = "XYZ".indexOf(side[1]), ext = side[0] === "+" ? b[3 + a] : b[a];
    if (Math.abs(p[a] - ext) <= 0.75 * h) return `face:${side}`;      // the outermost plane on that side : the whole side of the product
    const pt = patchAt(whole, p, hit.normal); if (!pt) return null;
    const i = patchInfo(whole, pt); return i && i.outer ? `face:${pt.dir}` : patchKey(pt);
  }
  /** Where a region is, as points with their outward direction (for its symbols and its highlight). */
  /* what the cuts keep of the box of the product ; a face of the product is still there when its side was not cut away */
  const keptBox = () => { const b = Array.from(whole.bbox); for (const c of st.cuts) { if (c.keep < 0) b[c.axis + 3] = Math.min(b[c.axis + 3], c.at); else b[c.axis] = Math.max(b[c.axis], c.at); } return b; };
  const stillThere = (face, kb) => { const i = "XYZ".indexOf(face[1]) + (face[0] === "+" ? 3 : 0); return Math.abs(kb[i] - whole.bbox[i]) < 1e-6; }, inside = (p, kb) => [0, 1, 2].every((i) => p[i] >= kb[i] - 1e-6 && p[i] <= kb[i + 3] + 1e-6);
  function spots(key, n = 3) {
    const r = regionOf(key), out = []; if (!r || !model) return out;
    const kb = keptBox();      // a symbol is drawn only on what is solved : what the cuts removed is answered for by its twin
    for (const it of r.list) { if (it.face) { if (stillThere(it.face, kb)) out.push(...sidePoints(kb, it.face, n).map((p) => ({ p, out: SIDES[it.face] }))); } else if (it.patch) out.push(...patchSpots(whole, it.patch, n === 1 ? 1 : 2 * n).filter((p) => inside(p, kb)).map((p) => ({ p, out: SIDES[it.patch.dir] }))); else { const p = it.near || (it.box ? [0, 1, 2].map((i) => (it.box[i] + it.box[3 + i]) / 2) : null); if (p && inside(p, kb)) out.push({ p, out: r.n || [0, 0, 1] }); } }
    return out;
  }
  function lightRegion(key, color, tag) {
    if (key.startsWith("face:")) { if (stillThere(key.slice(5), keptBox())) lightSide(vp.viewer, key.slice(5), { tag, color, ids: ["fea"] }); }
    else if (key.startsWith("patch:")) { const r = patchRegion(key); if (r && !r.gone && model && st.view === "model") lightTriangles(vp.viewer, "fea", patchFlags(model, r.patch), 1, { color, tag, opacity: 0.6 }); }
    else for (const s of spots(key)) vp.viewer.addMarker(s.p, color, tag, 2.2);
  }
  function pickRegion(hit) {
    if (!asking) return;
    const k = regionAt(hit);
    if (!k) { toast("Cliquez une face du produit — extérieure ou intérieure — ou une de ses interfaces.", "info", 3000); return; }
    const set = asking; asking = null; view.style.cursor = ""; vp.viewer.clearOverlays("bchover");
    set(k); lightRegion(k, LIT.chosen, "bcpick"); setTimeout(() => { if (alive) vp.viewer.clearOverlays("bcpick"); }, 1400);
  }
  /** A right click on a face of the part : hold it there, push there, heat there — the load case is built where the designer points. */
  function regionMenu(hit) {
    const k = hit ? regionAt(hit) : null; if (!k || !model) return [];
    const r = regionOf(k), name = r ? r.label : k, face = k.startsWith("face:") ? k.slice(5) : r && r.patch ? r.patch.dir : "+Z", into = `${face[0] === "+" ? "-" : "+"}${face[1]}`, heat = st.kind === "thermal" || (st.kind === "thermo" && !st.thermo.uniform);
    const add = (fn, text, group) => () => { fn(); if (group) st.sel = `${group[0]}${st[group[1]].length}`; changed(); lightRegion(k, LIT.chosen, "bcpick"); setTimeout(() => { if (alive) vp.viewer.clearOverlays("bcpick"); }, 1400); toast(text, "success", 2500); toEnter(); };
    /* what is already on this face : set it or take it away from here, as in the Isolation */
    const here = loadTree().flatMap((g) => g.items.filter((it) => it.region === k).flatMap((it) => [{ label: `Régler ${it.id} — ${it.text}`, icon: "edit", run: () => { select(it.id); toEnter(); } },
      { label: `Retirer ${it.id}`, icon: "trash", run: () => { st[g.key].splice(it.index, 1); st.sel = null; changed(); toast(`${it.id} retiré de ${name}`, "success", 2500); } }]));
    return [{ title: name }, ...here, ...(here.length ? ["—"] : []),
      ...(st.kind !== "thermal" && !st.fixed.includes(k) ? [{ label: "Appui ici (encastrement)", icon: "lock", run: add(() => { st.fixed.push(k); }, `Appui sur ${name}`, ["A", "fixed"]) }] : []),
      ...(st.kind === "structure" ? [{ label: `Effort ici : 100 N vers ${into}`, icon: "bolt", run: add(() => { st.loads.push({ region: k, mode: "force", F: 100, dir: into, p: 0.1, ask: ["F"] }); }, `Effort sur ${name} : entrez sa valeur à gauche`, ["E", "loads"]) },
        { label: "Pression ici : 0,1 MPa", icon: "flow", run: add(() => { st.loads.push({ region: k, mode: "pressure", F: 100, dir: into, p: 0.1, ask: ["p"] }); }, `Pression sur ${name} : entrez sa valeur à gauche`, ["E", "loads"]) }] : []),
      ...(heat ? [{ label: "Source de chaleur ici : 5 W", icon: "thermal", run: add(() => { st.power.push({ region: k, P: 5, ask: ["P"] }); }, `Source sur ${name} : entrez sa puissance à gauche`, ["Q", "power"]) }, { label: "Température imposée ici : 25 °C", icon: "thermal", run: add(() => { st.fixedT.push({ region: k, T: 25, ask: ["T"] }); }, `Température imposée sur ${name} : entrez-la à gauche`, ["T", "fixedT"]) }] : [])];
  }
  /** The symbols of the load case : clamps where the product is held, arrows where it is pushed and which way, marks for heat —
      each in the colour of its type, with its number ; the labels of a type show when its eye is open, the selected item always. */
  const regionName = (k) => (regionOf(k) || { label: k }).label, loadTree = () => bcTree(st, regionName);
  /** What the case still lacks or gets wrong, as the guide lists it. */
  const issues = () => (whole ? caseIssues(st, { regionOk: (k) => { const r = regionOf(k); return !!r && !r.gone; }, regionName }) : []);
  /* brings the first value that waits to the eye of the designer : its field blinks in the left panel */
  const toEnter = () => setTimeout(() => { if (alive) nudge(left.querySelector(".bc-edit input.need")); }, 90);
  function drawSymbols() {
    const v = vp.viewer; v.clearOverlays("sym"); v.clearOverlays("bcsel"); if (!model) return;
    const tag = "sym", tree = loadTree();
    for (const g of tree) for (const it of g.items) {
      if (it.kind === "symmetry") { for (const s of planeSpots(it.plane)) clamp(v, s.p, s.out, { tag, color: it.color }); continue; }
      if (it.kind === "fixed") for (const s of spots(it.region)) clamp(v, s.p, s.out, { tag, color: it.color });
      else if (it.kind === "pressure") for (const s of spots(it.region)) arrow(v, s.p, s.out.map((c) => -c), { tag, color: it.color, len: v._size() * 0.05 });
      else if (it.kind === "force") for (const s of spots(it.region, 2)) arrow(v, s.p, DIRS[st.loads[it.index].dir], { tag, color: it.color });
      else for (const s of spots(it.region, 2)) gem(v, s.p, { tag, color: it.color });
    }
    for (const it of bcLabels(tree, st.show, st.sel)) { const s = it.kind === "symmetry" ? planeSpots(it.plane, 1)[0] : spots(it.region, 1)[0]; if (!s) continue;
      const b = v.addLabel(s.p, it.short, tag, `bc${it.selected ? " sel" : ""}`, () => select(it.selected ? null : it.id)); b.style.borderColor = it.color; b.style.setProperty("--bc", it.color); b.dataset.tip = `${it.text} — ${it.where}`; b.setAttribute("aria-label", `${it.id} : ${it.text}, ${it.where}`); }
    const cur = st.sel ? bcFind(tree, st.sel) : null; if (cur && cur.item.region) lightRegion(cur.item.region, cur.item.color, "bcsel");
  }
  /* where a plane of symmetry shows its clamps : on the plane, spread over what is kept, pointing at the half that was removed */
  function planeSpots(pl, n = 2) {
    if (!whole) return []; const kb = keptBox(), a = pl.axis, [u, w] = [0, 1, 2].filter((k) => k !== a), out = [0, 0, 0], list = []; out[a] = -pl.keep;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const p = [0, 0, 0]; p[a] = pl.at; p[u] = kb[u] + (kb[u + 3] - kb[u]) * (i + 0.5) / n; p[w] = kb[w] + (kb[w + 3] - kb[w]) * (j + 0.5) / n; list.push({ p, out }); }
    return list;
  }
  /** The designer tries to remove the boundary a symmetry blocks : say why it cannot go alone, and offer to remove the symmetry. */
  async function unsym(it) {
    const ok = await confirmBox("Cette frontière vient de la symétrie", `${it.text} : ce plan est bloqué parce qu'il est un plan de symétrie — rien ne le traverse, et il tient la place de la moitié du produit qui n'est pas calculée. Il ne peut pas être retiré seul. Retirer la symétrie remet le produit entier dans le calcul : plus de cubes, le même résultat si le chargement est symétrique.`, "Retirer la symétrie", true);
    if (!ok || !alive) return; st.cuts = st.cuts.filter((c) => c.bc !== "sym"); st.sel = null; outdate(); remesh(false); toast("Symétrie retirée : le produit entier est calculé.", "success", 3500);
  }
  /** Selects an item of the load case (null : none) : it lights up on the model and opens in the tree. */
  function select(id) { st.sel = id; drawLeft(); drawSymbols(); }

  /* ---------- geometry and mesh ---------- */
  async function loadGeometry() {
    const stop = () => { kernel.cancel(); setStatus("Construction annulée", ""); vp.setBusy("Construction annulée : rien à simuler pour l'instant.", { stopped: true, retry: loadGeometry }); };
    vp.setBusy("Construction de la géométrie…", { cancel: stop }); last = null; runs = []; st.view = "model";
    try {
      if (st.target.type === "part") {
        const built = await kernel.build(store.part(st.target.id));
        geo = { bodies: built.bodies.map((b) => ({ name: b.name, pos: b.mesh.pos, idx: b.mesh.idx, material: feaMaterial(b.material) })), interfaces: built.interfaces, material: store.part(st.target.id).material };
      } else {
        const ctx = await buildAssembly(store.assembly(st.target.id), (t, done, total) => vp.setBusy(t, { done, total, cancel: stop })), bodies = [];
        for (const inst of ctx.asm.instances) for (const b of ctx.built[inst.part].bodies) bodies.push({ name: `${inst.part} · ${b.name}`, pos: b.mesh.pos, idx: b.mesh.idx, matrix: ctx.sol.placements[inst.id], material: feaMaterial(b.material) });
        geo = { bodies, interfaces: [] };
      }
      if (!alive) return;
      remesh(true);
    } catch (e) { if (e && e.cancelled) return; vp.setBusy(""); info.textContent = e.message; info.className = "chip bad"; }
  }
  function remesh(first) {
    { const one = oneSymmetry(st.cuts); if (one.dropped.length) { st.cuts = one.cuts; toast(`Une seule symétrie à la fois pour l'instant : le plan ${one.dropped.join(", ")} devient une coupe libre.`, "warn", 6000); } }
    try { whole = buildModel({ bodies: geo.bodies, target: st.cells, planes: st.cuts }); model = reduceModel(whole, st.cuts); syms = findSymmetries(whole); }
    catch (e) { vp.setBusy(""); info.textContent = e.message; info.className = "chip bad"; if (st.cuts.length) { toast(`${e.message} Le dernier plan est retiré.`, "warn", 6000); st.cuts.pop(); return remesh(first); } model = null; whole = null; drawRight(); return; }
    const b = whole.bbox, h = model.grid.h; patches.clear();
    regions = FACES.map(([k, l]) => ({ key: `face:${k}`, label: `Face ${l}`, list: [{ face: k }] }));
    for (const it of geo.interfaces) {
      const f = it.frame, sign = it.side === "B" ? -1 : 1, at = (pu, pv, pn = 0) => [0, 1, 2].map((i) => f.o[i] + pu * f.u[i] + pv * sign * f.v[i] + pn * f.n[i]);
      if (it.type === "bolt_pattern" || it.type === "pins") {     // held or loaded where the screws are, not over the whole pattern
        const d = it.type === "pins" ? it.params.d : thread(it.params.screw).washer, count = Math.max(1, Math.round(it.params.n || 2)), pts = it.type === "pins" ? Array.from({ length: count }, (_, k) => [(k - (count - 1) / 2) * it.params.pitch, 0]) : patternPoints(it.params.pattern);
        regions.push({ key: `iface:${it.id}`, n: f.n, label: `Interface ${it.id} — ${it.name} (${pts.length} vis)`.replace("vis)", it.type === "pins" ? "goupilles)" : "vis)"), list: pts.map(([pu, pv]) => ({ near: at(pu, pv), r: Math.max(d / 2, 0.75 * h) })) });
      } else {
        const fp = footprint(it, geo.material), pts = [];
        for (const su of [-1, 1]) for (const sv of [-1, 1]) for (const sn of [-1, 1]) pts.push(at(su * fp.w / 2, sv * fp.h / 2, sn * h));
        regions.push({ key: `iface:${it.id}`, n: f.n, label: `Interface ${it.id} — ${it.name}`, list: [{ box: [0, 1, 2].map((i) => Math.min(...pts.map((q) => q[i]))).concat([0, 1, 2].map((i) => Math.max(...pts.map((q) => q[i])))) }] });
      }
    }
    if (!st.fixed.length || !st.fixed.every((k) => regionOf(k))) {            // a sensible first case: held at one end of the longest side, loaded at the other
      const dims = [b[3] - b[0], b[4] - b[1], b[5] - b[2]], a = dims.indexOf(Math.max(...dims)), ax = "XYZ"[a], iface = regions.find((r) => r.key.startsWith("iface:"));
      st.fixed = [iface ? iface.key : `face:-${ax}`];
      st.loads = [{ region: iface ? `face:${dims[2] <= Math.min(dims[0], dims[1]) ? "+Z" : `+${ax}`}` : `face:+${ax}`, mode: iface && dims[2] <= Math.min(dims[0], dims[1]) ? "pressure" : "force", F: 100, dir: a === 2 ? "-Y" : "-Z", p: 0.002 }];
      st.loads[0].ask = [st.loads[0].mode === "pressure" ? "p" : "F"];      // a first case to start from : its values are examples, the designer enters his own
      st.power = [{ region: "face:-Z", P: 5, ask: ["P"] }]; st.fixedT = []; st.sel = st.kind === "structure" ? "E1" : st.kind === "thermal" ? "Q1" : st.sel;      // the value that waits is open, where the eye falls
    }
    showMesh(); drawLeft(); refreshEstimate(); drawSwitch();
    if (first) vp.viewer.view("iso");
    vp.setBusy("");
  }
  function showMesh() {
    const s = skin(model, null), col = new Float32Array(s.pos.length).fill(0.72);
    vp.viewer.clear(); vp.viewer.addField("fea", { pos: s.pos, idx: s.idx, col, epos: s.epos, pickable: true });
    info.textContent = `${model.cut ? `Modèle ${fraction(model.cut.copies)} · ` : ""}${model.nCells.toLocaleString("fr-CA")} cubes de ${fmt(model.grid.h, 2)} mm · ${model.nNodes.toLocaleString("fr-CA")} nœuds`; info.className = "chip";
  }
  /* ---------- the two views : the model with its conditions, the last result ---------- */
  /** The case or the mesh changed : the result is kept, said to be of before, and the model comes back to the view. */
  const outdate = () => { if (last) last.stale = true; st.view = "model"; };
  const drawSwitch = () => vp.setStatus(viewSwitch({ view: st.view, last, onView: setView }), info);
  function setView(v) {
    st.view = v === "result" && last && last.skin ? "result" : "model"; asking = null; view.style.cursor = "";
    const o = vp.viewer; o.clearOverlays("bc"); o.clearOverlays("bchover"); o.clearOverlays("bcsel");
    if (st.view === "result") { paint(); peak(); drawSymbols(); drawRight(); } else { showMesh(); refreshEstimate(); }
    drawSwitch();
  }
  /* the worst point of the result shown, with its value : the peak stress or temperature, or the smallest safety factor */
  function peak() {
    const o = vp.viewer, thermal = last.kind === "thermal", p = thermal ? last.result.maxT : last.result.maxVm; o.clearOverlays("bc");
    if (!thermal && st.quantity === "fs" && last.fs) { const S = safetySummary(last.fs, st.fsTarget); if (S.min !== null && S.at >= 0) { const at = Array.from(last.skin.pos.subarray(3 * S.at, 3 * S.at + 3)); o.addMarker(at, "#ff5a4f", "bc", 1.8); o.addLabel(at, `FS ${Number.isFinite(S.min) ? show(S.min, 2) : "∞"}`, "bc", S.min < st.fsTarget ? "err" : ""); } return; }
    o.addMarker(p.at, "#ff5a4f", "bc", 1.8); o.addLabel(p.at, thermal ? `${show(p.value, 1)} °C` : `${show(p.value, 1)} MPa`, "bc", "err");
  }
  /** The simple regions of a choice: one for a face, one per screw for a bolted interface (the effort is shared between them). */
  const listOf = (key) => (regionOf(key) || regions[0]).list;
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
  /** Is the case the same on both sides of a plane ? */
  function symmetric(plane) {
    const heat = st.kind === "thermal" || (st.kind === "thermo" && !st.thermo.uniform), entries = [];
    if (st.kind !== "thermal") { st.fixed.forEach((k, i) => listOf(k).forEach((region) => entries.push({ what: "appui", label: `Appui ${i + 1}`, region })));
      if (st.kind === "structure") st.loads.forEach((l, i) => listOf(l.region).forEach((region, j, all) => entries.push({ what: `effort ${l.mode}`, label: `Effort ${i + 1}`, region, vector: l.mode === "pressure" ? null : DIRS[l.dir].map((c) => c * l.F / all.length) }))); }
    if (heat) { st.power.forEach((x, i) => listOf(x.region).forEach((region) => entries.push({ what: "chaleur", label: `Source ${i + 1}`, region }))); st.fixedT.forEach((x, i) => listOf(x.region).forEach((region) => entries.push({ what: "température", label: `Température ${i + 1}`, region }))); }
    try { return loadSymmetry(entries, plane, (r) => regionInfo(whole, r), whole.grid.h); } catch (e) { return { ok: false, notes: [e.message] }; }
  }
  function refreshEstimate() {
    if (!model) return;
    const mat = geo.bodies[0].material;
    try { estimate = st.kind === "thermal" ? precheckThermal(whole, loadCase(), mat) : st.kind === "thermo" ? precheckThermo(whole, loadCase(), mat) : precheckStructure(whole, loadCase(), mat); }      // by hand, on the product entire : a cut changes the cost, not the answer
    catch (e) { estimate = { kind: "none", title: "Cas incomplet", steps: [e.message], values: {}, warnings: [] }; }
    const v = vp.viewer; v.clearOverlays("bc");
    if (estimate.where) v.addMarker(estimate.where, "#0c66e4", "bc", 1.6);
    if (estimate.at && estimate.where) v.addPath([estimate.where, estimate.at], "#ff5a4f", "bc", 0.6, true);
    drawSymbols(); drawRight();
  }

  /* ---------- left: what is simulated and how it is held and loaded ---------- */
  const sel = (value, opts, onChange) => el("select", { onChange: (e) => onChange(e.target.value) }, opts.map(([k, l]) => el("option", { value: k, selected: k === value }, l)));
  const num = (value, onChange, step = "any") => el("input", { type: "number", value, step, onChange: (e) => { const x = parseFloat(e.target.value); if (Number.isFinite(x)) onChange(x); } });
  const changed = () => { outdate(); showMesh(); drawLeft(); refreshEstimate(); drawSwitch(); };
  /* a field that loses the focus while the panel is redrawn asks for a redraw of its own : one at a time, the last one wins */
  let drawing = false, again = false;
  function drawLeft() { if (drawing) { again = true; return; } drawing = true; try { paintLeft(); } finally { drawing = false; if (again) { again = false; drawLeft(); } } }
  function paintLeft() {
    clear(left);
    left.append(el("img", { class: "side-mark", src: "img/marks/physique.svg", alt: "" }), el("div", { class: "side-head" }, el("h2", null, "Simulation")));
    const scroll = el("div", { class: "side-scroll" });
    left.append(scroll);
    scroll.append(el("div", { class: "subtabs" }, el("a", { class: "subtab", href: "#/physics" }, "Modèles analytiques"), el("a", { class: "subtab active", href: "#/fea" }, "Simulation")),
      el("div", { class: "side-section" }, field("Ce que l'on simule", sel(st.target.id, targets.map((t) => [t.id, `${t.type === "part" ? "Pièce" : "Assemblage"} — ${t.name}`]), (id) => { st.target = targets.find((t) => t.id === id); st.fixed = []; loadGeometry(); })),
        field("Physique", sel(st.kind, [["structure", "Structure — efforts et déformations"], ["thermal", "Thermique — régime permanent"], ["thermo", "Thermo-mécanique — dilatation et contraintes"]], (k) => { st.kind = k; changed(); })),
        field("Finesse du maillage", el("input", { type: "range", min: 500, max: 16000, step: 500, value: st.cells, onChange: (e) => { st.cells = +e.target.value; outdate(); remesh(false); } }), `Environ ${st.cells.toLocaleString("fr-CA")} cubes : grossier et rapide. Les détails plus petits qu'un cube sont ignorés.`)));
    const sec = el("div", { class: "side-section" });
    scroll.append(sec);
    if (whole) scroll.append(cutsSection({ st, kind: st.kind, syms, bbox: whole.bbox, symmetric, apply: () => { outdate(); remesh(false); } }));
    const heat = st.kind === "thermal" || (st.kind === "thermo" && !st.thermo.uniform);
    if (st.sel && !bcFind(loadTree(), st.sel)) st.sel = null;
    const DEFAULT = { fixed: () => regions[0].key, loads: () => ({ region: regions[1].key, mode: "force", F: 100, dir: "-Z", p: 0.1, ask: ["F"] }), power: () => ({ region: regions[0].key, P: 5, ask: ["P"] }), fixedT: () => ({ region: regions[5].key, T: 25, ask: ["T"] }) };
    const aim = (set) => { if (st.view === "result") setView("model"); asking = set; view.style.cursor = "crosshair"; toast("Cliquez une face du produit, extérieure ou intérieure, ou une interface : elle s'allume sous le curseur. Face cachée ? Tournez la vue ou coupez-la.", "info", 4200); };
    const go = (x) => { if (x.id && st.sel !== x.id) select(x.id); setTimeout(() => { if (alive) nudge(left.querySelector(x.field ? `.bc-edit [data-field="${x.field}"]` : x.id ? `[data-bc="${x.id}"]` : ".bc-tree")); }, 90); };
    const found = issues(); setGuide(found.map((x) => ({ ...x, si: true, go: () => go(x) })));      // the guide of the top bar says the same
    sec.append(el("h3", null, "Cas de charge"), ...[guideBox(found, { go, si: true })].filter(Boolean), bcSection({ st, tree: loadTree(), regions: [...regions, ...usedPatches()], dirs: DIRS, select, changed, aim, relabel: () => { drawLeft(); drawSymbols(); },
      hover: (k, color) => { vp.viewer.clearOverlays("bchover"); if (k && !asking) lightRegion(k, color || LIT.named, "bchover"); },
      add: (key) => { st[key].push(DEFAULT[key]()); const g = loadTree().find((x) => x.key === key), it = g.items[g.items.length - 1]; st.sel = it.id; changed(); aim((k) => { if (key === "fixed") st.fixed[it.index] = k; else st[key][it.index].region = k; changed(); toEnter(); }); },
      remove: (key, i) => { st[key].splice(i, 1); st.sel = null; changed(); }, unsym }),
      el("p", { class: "muted small" }, "Un clic sur une ligne la montre sur le modèle et ouvre ses valeurs ; l'œil d'un type affiche ou masque ses étiquettes. Un clic droit sur une face du modèle — intérieure aussi : tournez la vue, ou coupez-la — y pose un appui, un effort ou une source, et règle ou retire ce qui s'y trouve. Une valeur qui clignote est un exemple : entrez la vôtre."));
    if (st.kind === "thermo") sec.append(el("h3", { style: { marginTop: ".7rem" } }, "Température"),
      el("div", { class: "bc-row" }, el("small", null, "Montage sans contrainte à"), num(st.thermo.Tref, (v) => { st.thermo.Tref = v; changed(); }), el("small", null, "°C")),
      el("label", { class: "check" }, el("input", { type: "checkbox", checked: st.thermo.uniform, onChange: (e) => { st.thermo.uniform = e.target.checked; changed(); } }), "Pièce à température uniforme"),
      st.thermo.uniform ? el("div", { class: "bc-row" }, num(st.thermo.T, (v) => { st.thermo.T = v; changed(); }), el("small", null, "°C en service")) : el("p", { class: "muted small" }, "Le champ de température est d'abord calculé avec les sources ci-dessus, puis appliqué à la structure."));
    if (heat) sec.append(...[el("h3", { style: { marginTop: ".7rem" } }, "Convection sur l'extérieur"), el("label", { class: "check" }, el("input", { type: "checkbox", checked: st.conv.on, onChange: (e) => { st.conv.on = e.target.checked; changed(); } }), "Toutes les faces exposées"),
      st.conv.on ? el("div", { class: "bc-row" }, num(st.conv.h, (v) => { st.conv.h = v; changed(); }), el("small", null, "W/m²·K"), num(st.conv.Tamb, (v) => { st.conv.Tamb = v; changed(); }), el("small", null, "°C")) : null,
      el("p", { class: "muted small" }, "Air calme : 5 à 15 W/m²·K ; air soufflé : 25 à 100 ; plaque froide à eau : 500 et plus.")].filter(Boolean));
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
    const go = btn(last ? "Relancer la simulation" : "Lancer la simulation", () => run(), { primary: true, icon: "play" }), wait = blocking(issues());
    const flip = last && last.skin ? btn(st.view === "result" ? "Revenir au modèle" : `Voir le résultat ${last.n}`, () => setView(st.view === "result" ? "model" : "result"), { icon: st.view === "result" ? "edit" : "eye", tip: st.view === "result" ? "Le modèle, ses appuis, ses efforts et leurs étiquettes : pour modifier le cas" : "Le dernier calcul, en couleurs" }) : null;
    body.append(el("div", { class: "side-section" }, el("h3", null, "2. La simulation"), el("p", { class: "muted small" }, "Cubes identiques, hexaèdre à modes incompatibles (flexion juste même avec un élément dans l'épaisseur), gradient conjugué. Tout le code du solveur est dans ce dépôt, sous licence MIT."),
      el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } }, go, flip),
      ...(wait.length ? [el("p", { class: "atelier-hint warn" }, icon("warning"), ` Avant de lancer — ${guideSummary(wait)}, dans le cas de charge à gauche.`)] : [])));
    if (!last) return;
    resultPanel(body, { last, st, runs, mat: geo.bodies[0].material, keep, setView,
      repaint: (only) => { if (st.view !== "result") { setView("result"); return; } paint(); peak(); if (!only) drawRight(); },
      pick: (x) => { last = x; setView("result"); } });
  }
  /** Paints the result : the stress (or the temperature) on the current scale — blue to red inside, magenta above, grey below — or the
      safety factor against the one aimed at — red below it, then orange, blue, green. */
  function paint() {
    if (!last || !last.skin) return;
    const s = last.skin, [a, b] = last.range, col = new Float32Array(s.pos.length);
    if (st.quantity === "fs" && last.kind !== "thermal" && last.fs) for (let i = 0; i < last.fs.length; i++) { const c = fsColour(last.fs[i], st.fsTarget); col[3 * i] = c[0]; col[3 * i + 1] = c[1]; col[3 * i + 2] = c[2]; }
    else for (let i = 0; i < s.val.length; i++) { const x = s.val[i], c = x > b * (1 + 1e-9) + 1e-12 ? [0.85, 0.27, 0.94] : x < a - 1e-9 * Math.abs(a) - 1e-12 ? [0.62, 0.64, 0.68] : colour((x - a) / (b - a)); col[3 * i] = c[0]; col[3 * i + 1] = c[1]; col[3 * i + 2] = c[2]; }
    vp.viewer.addField("fea", { pos: s.pos, idx: s.idx, col, epos: s.epos, pickable: true });
  }
  function run() {
    if (!model) return;
    const wait = blocking(issues());      // what must be entered or put right first : the guide takes the designer there
    if (wait.length) { const x = wait[0]; if (x.id) st.sel = x.id; drawLeft(); drawSymbols(); toast(`Avant de lancer : ${x.text}`, "warn", 8000); setTimeout(() => { if (alive) nudge(left.querySelector(x.field ? `.bc-edit [data-field="${x.field}"]` : x.id ? `[data-bc="${x.id}"]` : ".guide")); }, 90); return; }
    if (worker) worker.terminate();
    worker = new Worker(new URL("../analysis/fea/worker.js", import.meta.url), { type: "module" });
    const id = ++seq, kind = st.kind, est = estimate;
    const halt = () => { if (worker) { worker.terminate(); worker = null; } vp.setBusy(""); setStatus("Simulation annulée", ""); toast("Simulation annulée : le dernier résultat gardé reste affichable.", "info"); };
    vp.setBusy("Résolution…", { cancel: halt }); setStatus("Simulation en cours…", "busy");
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.id !== id || !alive) return;
      if (m.progress !== undefined) { vp.setBusy(`Résolution… itération ${m.progress.iteration || ""}`, { cancel: halt }); return; }
      vp.setBusy(""); worker.terminate(); worker = null;
      if (!m.ok) { setStatus("Simulation impossible", "bad"); toast(m.error, "error", 9000); return; }
      const s = m.skin, lo = kind === "thermal" ? m.result.minT.value : 0, hi = kind === "thermal" ? m.result.maxT.value : m.result.maxVm.value;
      last = { n: (runs.length ? runs[runs.length - 1].n : 0) + 1, kind, stale: false, skin: s, data: [lo, hi > lo ? hi : lo + 1], range: [lo, hi > lo ? hi : lo + 1], result: m.result, info: m.info, compare: compare(kind, est, m.result), estimate: est,
        fs: kind !== "thermal" && s.re ? safetyField(s.val, s.re) : null };
      runs.push(last); if (runs.length > 6) runs[runs.length - 7].skin = null;      // the six last trials can be shown again ; the older ones keep their figures
      setStatus(`Simulation : ${m.result.iterations} itérations, ${fmt(m.result.ms / 1000, 2)} s`, "done");
      setView("result");
    };
    worker.onerror = (e) => { vp.setBusy(""); setStatus("Simulation impossible", "bad"); toast(`Le solveur s'est arrêté : ${e.message || "erreur inconnue"}.`, "error", 9000); };
    worker.postMessage({ id, kind, bodies: geo.bodies, mesh: { target: st.cells, planes: st.cuts }, cuts: st.cuts, load: loadCase() });
  }
  function keep() {
    if (!last) return;
    const r = last.result, mat = geo.bodies[0].material, thermal = last.kind === "thermal", nominal = r.nominalVm ? r.nominalVm.value : null;
    store.commit(`Simulation gardée : ${st.target.id}`, (x) => { x.simulations = x.simulations || []; x.simulations.push({ id: `S${x.simulations.length + 1}`, kind: last.kind, target: st.target.id, cells: last.info.cells, h: last.info.h, ...(last.info.cuts ? { cuts: last.info.cuts, copies: last.info.copies } : {}),
      estimate: thermal ? { Tmax: last.estimate.values.Tmax } : { sigma: (last.kind === "thermo" && last.estimate.values.sigmaPlate) || last.estimate.values.sigma, delta: last.estimate.values.delta },
      result: thermal ? { Tmax: r.maxT.value, Tmin: r.minT.value } : { sigma: r.maxVm.value, nominal, delta: r.maxU.value, sf: mat.Re ? mat.Re / r.maxVm.value : null, ...(last.kind === "thermo" ? { Tmax: r.maxT.value, core: r.coreVm ? r.coreVm.value : null } : {}) },
      worst: last.compare.rows.length ? last.compare.worst : null, verdict: last.compare.verdict, when: new Date().toISOString() }); });
    toast("Simulation ajoutée au rapport de revue.", "success");
  }

  vp.setStatus(info);                                    // whatever stops the first mesh is said in the view, before the switch of views exists
  loadGeometry();
  return () => { alive = false; if (worker) worker.terminate(); vp.dispose(); };
}

registerModule({ key: "fea", label: "Simulation", icon: "physics", hidden: true, tip: "Éléments finis simplifiés, structure et thermique, recoupés par un calcul à la main", render });
