/* DesignOrbit.ai — Simulation: a deliberately simple finite-element model for structure and steady-state thermal.
   The part or the assembly is meshed coarsely with identical cubes, the efforts are set on its boundaries (faces and
   interfaces), and BEFORE anything is solved the screen writes the hand calculation of the equivalent simple model —
   what a good analyst does first. The simulation then runs in a worker and is compared with that estimate.
   Route: #/fea or #/fea/<part|assembly id>. Runs kept for the review live in project.simulations ; the load case of each part
   or assembly lives in project.cases (analysis/fea/case_store.js) : every change is one undoable step, read back at the next visit. */

import { el, clear, icon, btn, badge, field, table, fmt, toast, confirmBox, promptBox } from "../core/dom.js";
import { registerModule, setStatus, setGuide } from "../core/app.js";
import { validationSection } from "./validation_view.js";
import { store } from "../core/store.js";
import { kernel } from "../cad/client.js";
import { createViewport } from "../core/viewport.js";
import { buildAssembly } from "../core/asm_scene.js";
import { props } from "../analysis/physics/props.js";
import { footprint } from "../core/shop_intent.js";
import { patternPoints } from "../cad/interfaces.js";
import { thread } from "../cad/standards.js";
import { buildModel, skin, regionInfo } from "../analysis/fea/index.js";
import { exposedFaces } from "../analysis/fea/voxel.js";
import { findSymmetries, reduceModel, loadSymmetry, oneSymmetry, cutFaces } from "../analysis/fea/symmetry.js";
import { cutsSection, cutMenu, fraction } from "./fea_cuts.js";
import { precheckStructure, precheckThermal, precheckThermo, compare } from "../analysis/fea/precheck.js";
import { VERDICT, show } from "../analysis/fea/summary.js";
import { lightSide, sidePoints, arrow, clamp, gem, SIDES, LIT } from "../core/view_marks.js";
import { bakeMesh, clipMesh } from "../core/mesh_clip.js";
import { bodyId, bodyOf, CUT_FIELD, placeItem, placeKey, placeLabel, placeRegion, placeNormal, placeSpots, placeHasFace, lightPlace, checkPlaces } from "./fea_places.js";
import { caseIssues, blocking } from "../analysis/fea/case_check.js";
import { guideBox, guideSummary, nudge } from "../core/guide.js";
import { bcTree, bcFind, bcLabels, BC_COLORS, loadDir, pushInto, supportKey, supportDofs, isOff, onOf, withOff, copyOf, soloOn, caseWords, liveCuts } from "../analysis/fea/bc_tree.js";
import { bcSection } from "./fea_tree.js";
import { viewSwitch, resultPanel } from "./fea_result.js";
import { safetyField, safetySummary, fsColour } from "../analysis/fea/safety.js";
import { prepareZones, zoneIssues, normZone } from "../analysis/fea/refine.js";
import { compositeSkin } from "../analysis/fea/composite.js";
import { zoneWalls } from "../analysis/fea/entity.js";
import { zonesSection, zoneMenu, drawZones, ZONE_TINT } from "./fea_zones.js";
import { caseOf, takeCase, withCase, sameCase, sameSolve, FIRST_CASE, caseList, freshCaseName, addCase, useCase, renameCase, dropCase } from "../analysis/fea/case_store.js";
import { casesSection } from "./fea_cases.js";
import { readSensors, sensorIssues, sensorKindsFor, newSensor, keptSensors, isSensorId, SENSOR_KINDS } from "../analysis/fea/sensors.js";
import { sensorsSection, sensorMenu, drawSensors } from "./fea_sensors.js";
import { undeform } from "../analysis/fea/probe.js";
import { fieldColours, isInfrared } from "../analysis/fea/palette.js";

const FACES = [["-X", "gauche (−X)"], ["+X", "droite (+X)"], ["-Y", "avant (−Y)"], ["+Y", "arrière (+Y)"], ["-Z", "dessous (−Z)"], ["+Z", "dessus (+Z)"]];
const st = { target: null, kind: "structure", cells: 3000, cuts: [], zones: [], places: {}, placeSeq: 0, fixed: [], loads: [], power: [], fixedT: [], conv: { on: true, h: 10, Tamb: 25 }, thermo: { uniform: true, T: 80, Tref: 20 }, sensors: [], sel: null, show: {}, view: "model", quantity: "stress", palette: "rainbow", fsTarget: 1.5 };      // sensors : the instruments, read on the result ; palette : the colour scale of a thermal result (an infrared one, or the one of a calculation) ; places : the faces, edges and points of the part that carry a condition (fea_places.js) ; sel : the item of the load case that is selected (A1, E2…) ; show : the labels of a type, on or off ; view : the model with its conditions, or the last result ; quantity : what the colours of a result show (stress or safety factor, against fsTarget)
let seq = 0;

/** Material of a body for the simulation (typical values; the data sheet of the grade prevails). */
export function feaMaterial(id) {
  const p = props(id) || {}, E = p.E ? (p.E < 2000 ? p.E * 1000 : p.E) : 3000;
  return { id: id || "?", name: p.name || id || "matériau inconnu", E, nu: p.nu || 0.33, k: p.k || 0.3, rho: p.rho || 1200, Re: p.Re || null, alpha: (p.cte || 0) * 1e-6, known: !!p.E };
}

function render(main, args) {
  const p = store.project, targets = [...p.parts.map((x) => ({ type: "part", id: x.id, name: x.name || x.id })), ...p.assemblies.map((a) => ({ type: "assembly", id: a.id, name: a.name || a.id }))];
  const left = el("aside", { class: "side" }), right = el("aside", { class: "side right" }), view = el("div"), root = el("div", { class: "studio" }, left, view, right);
  main.append(root);
  if (!targets.length) { root.replaceWith(el("div", { class: "page" }, el("div", { class: "empty" }, el("h2", null, "Rien à simuler"), el("p", null, "Créez d'abord une pièce dans l'Atelier."), el("a", { class: "btn btn-primary", href: "#/shop" }, "Aller à l'Atelier")))); return null; }
  if (args[0] && targets.some((t) => t.id === args[0])) st.target = targets.find((t) => t.id === args[0]);
  if (!st.target || !targets.some((t) => t.id === st.target.id)) st.target = targets[0];
  { const key = `${p.id}:${st.target.id}`; if (st.from !== key) st.sel = null; st.from = key; takeCase(st, caseOf(p, st.target.id)); }      // the case as the project keeps it : what an earlier visit set, or a teammate
  const vp = createViewport(view, { name: () => `${st.target.id}_simulation`,
    menuFor: (hit, x, sel) => { const inst = model && hit && hit.point ? sensorMenu(sensorKinds(), (k) => putSensor(k, hit)) : [];      // an instrument is put on the model or on the result
      if (st.view === "result") return [{ title: `Résultat ${last ? last.n : ""} affiché` }, { label: "Revenir au modèle pour modifier le cas", icon: "edit", run: () => setView("model") }, ...(inst.length ? ["—", ...inst] : [])];
      const on = !!(hit && hit.point && (bodyOf(hit.id) >= 0 || hit.id === CUT_FIELD)), own = placeMenu(hit, sel), cut = whole && on ? cutMenu(hit, st, () => { outdate(); remesh(false); }) : [];
      const zone = model && on ? zoneMenu(hit, st, model, (z) => { applyZones(); toast(`Zone ${z.id} posée : entrez ses cotes à gauche.`, "success", 3500); setTimeout(() => { if (alive) nudge(left.querySelector(`[data-zone="${z.id}"] input.need`) || left.querySelector(`[data-zone="${z.id}"]`)); }, 90); }) : [];
      return [...own, ...(own.length && cut.length ? ["—"] : []), ...cut, ...(zone.length && (own.length || cut.length) ? ["—"] : []), ...zone, ...(on && inst.length ? ["—", ...inst] : [])]; },
    onPick: (hit) => { if (askingPoint) { const set = askingPoint; askingPoint = null; view.style.cursor = ""; if (hit && hit.point) set(hit.point, hit.normal, hit); return true; } if (!asking) return false; pickRegion(hit); return true; } }), info = el("span", { class: "chip" }, "—");
  let geo = null, model = null, whole = null, syms = [], regions = [], estimate = null, last = null, runs = [], worker = null, alive = true, asking = null, askingPoint = null, zonePreps = [], litZone = null, litSensor = null;      // zonePreps : the refinement zones as the mesh took them ; askingPoint : the next click gives a point (the centre of a zone)
  /* ---------- refinement zones : meshed on the page to be seen, solved in the worker with the model ---------- */
  const liveZones = () => st.zones.filter((z) => !z.off);      // a zone put aside (off) is kept, and neither meshed nor solved
  const rezone = () => { try { zonePreps = model ? prepareZones(model, geo.bodies, liveZones()) : []; } catch (e) { zonePreps = liveZones().map((z) => ({ id: z.id, error: e.message })); } };
  const applyZones = () => { rezone(); changed(); };
  /* the volumes of the zones are tools : shown while the model is defined, put away on the result — and either way on demand (the eye of their group) ; the one under the pointer always shows */
  const zonesOn = () => (st.view === "result" ? st.show.zonesResult === true : st.show.zones !== false);
  const showZones = () => drawZones(vp.viewer, st.zones.filter((z) => z === litZone || (zonesOn() && !z.off)), litZone, (z) => nudge(left.querySelector(`[data-zone="${z.id}"]`)));
  const zoneInfo = (z) => { const p = zonePreps.find((x) => x.id === z.id); return !p || !model ? null : p.prep ? { cells: p.prep.local.nCells, block: p.prep.block.count, h: model.grid.h, walls: normZone(z) ? zoneWalls(model, normZone(z)).length : 0 } : { error: p.error }; };
  /* ---------- instruments : read on the result that is kept — putting one, moving it, turning a gauge solves nothing again ---------- */
  const sensorKinds = () => sensorKindsFor(st.kind, st.kind === "thermal" || (st.kind === "thermo" && !st.thermo.uniform)), probeNow = () => (last && last.probe) || null, readings = () => readSensors(probeNow(), st.sensors);
  const cardOf = (id) => left.querySelector(`[data-sensor="${id}"]`), showSensors = () => drawSensors(vp.viewer, st.sensors, readings(), { shown: st.show.sensors !== false, lit: litSensor, result: st.view === "result", kinds: st.view === "result" && last ? sensorKindsFor(last.kind, true) : sensorKinds(), onClick: (s) => nudge(cardOf(s.id)) });
  const sensorsChanged = (s) => { saveCase(); drawLeft(); showSensors(); if (last) drawRight(); if (s) setTimeout(() => { if (alive) nudge((cardOf(s.id) || left).querySelector("input.need") || cardOf(s.id)); }, 90); };
  /* a point of the view as a point of the product : a click on the result lands on the deformed shape, and is brought back */
  const onProduct = (hit) => ({ at: st.view === "result" && probeNow() ? undeform(probeNow(), hit.point) : hit.point, normal: hit.normal, body: bodyOf(hit.id) >= 0 ? geo.bodies[bodyOf(hit.id)].name : null });
  const putSensor = (kind, hit) => { const w = onProduct(hit), s = newSensor(st.sensors, kind, w.at, w); st.sensors.push(s); sensorsChanged(s); toast(`${s.id} posé — ${SENSOR_KINDS[kind].label}${kind === "gauge" ? " : tournez-la ou confirmez son axe, à gauche" : probeNow() ? "" : " : il se lira sur le résultat"}.`, "success", 3800); };
  const aimSensor = (set) => { asking = null; askingPoint = (p, n, hit) => { const w = onProduct(hit); set(w.at, w.normal, w.body); }; view.style.cursor = "crosshair"; toast("Cliquez sur la pièce l'endroit où poser l'instrument.", "info", 4200); };
  /* where the guide sends the designer : a value of the load case, an item of its tree, a zone and its cote, or an instrument */
  const aside = (id) => (id[0] === "Z" ? "zone" : isSensorId(id) ? "sensor" : null);
  const spot = (x) => (x.id && aside(x.id) ? (x.field && left.querySelector(`[data-${aside(x.id)}="${x.id}"] [data-field="${x.field}"]`)) || left.querySelector(`[data-${aside(x.id)}="${x.id}"]`) : left.querySelector(x.field ? `.bc-edit [data-field="${x.field}"]` : x.id ? `[data-bc="${x.id}"]` : ".bc-tree"));
  const RANK = { error: 0, todo: 1, warn: 2, tip: 3 };      // whole : the product entire ; model : what is solved — the same, or what the cuts keep

  /* ---------- pointing at the part : the view shows the part itself — any face, edge or point of it carries a condition ---------- */
  /* a place : faces, edges, points chosen in the view (one, or several with Ctrl + click), or the face a cut leaves — kept in st.places */
  const placeOf = (key) => { const p = st.places[key]; return p ? { key, label: p.gone ? `${p.label} — introuvable sur cette géométrie` : p.label, list: p.gone ? [] : [placeRegion(p, geo)], gone: !!p.gone, place: p } : null; };
  const regionOf = (key) => regions.find((r) => r.key === key) || placeOf(key);
  const usedPlaces = () => [...new Set([...st.fixed.map(supportKey), ...st.loads.map((x) => x.region), ...st.power.map((x) => x.region), ...st.fixedT.map((x) => x.region)].filter((k) => String(k).startsWith("place:")))].map(placeOf).filter(Boolean);
  /* what the cuts keep of the box of the product ; a face of the product is still there when its side was not cut away */
  const cuts = () => liveCuts(st.cuts);      // the planes that count : one put aside (off) is kept in the panel and cuts nothing
  const keptBox = () => { const b = Array.from(whole.bbox); for (const c of cuts()) { if (c.keep < 0) b[c.axis + 3] = Math.min(b[c.axis + 3], c.at); else b[c.axis] = Math.max(b[c.axis], c.at); } return b; };
  const stillThere = (face, kb) => { const i = "XYZ".indexOf(face[1]) + (face[0] === "+" ? 3 : 0); return Math.abs(kb[i] - whole.bbox[i]) < 1e-6; }, inside = (p, kb) => [0, 1, 2].every((i) => p[i] >= kb[i] - 1e-6 && p[i] <= kb[i + 3] + 1e-6);
  const bodies = () => geo.bodies.map((_, k) => bodyId(k));
  /** Where a region is, as points with their outward direction (for its symbols and its highlight). */
  function spots(key, n = 3) {
    const r = regionOf(key), out = []; if (!r || !model) return out;
    const kb = keptBox();      // a symbol is drawn only on what is solved : what the cuts removed is answered for by its twin
    if (r.place) return placeSpots(r.place, geo, n, [0, 1, 2].map((i) => (whole.bbox[i] + whole.bbox[i + 3]) / 2), (axis) => { const c = cuts().find((x) => x.axis === axis); return c ? { at: c.at, keep: c.keep < 0 ? -1 : 1, box: kb } : null; }).filter((s) => inside(s.p, kb));
    for (const it of r.list) { if (it.face) { if (stillThere(it.face, kb)) out.push(...sidePoints(kb, it.face, n).map((p) => ({ p, out: SIDES[it.face] }))); } else { const p = it.near || (it.box ? [0, 1, 2].map((i) => (it.box[i] + it.box[3 + i]) / 2) : null); if (p && inside(p, kb)) out.push({ p, out: r.n || [0, 0, 1] }); } }
    return out;
  }
  function lightRegion(key, color, tag) {
    const r = regionOf(key); if (!r || st.view !== "model") return;
    if (key.startsWith("face:")) { if (stillThere(key.slice(5), keptBox())) lightSide(vp.viewer, key.slice(5), { tag, color, ids: bodies() }); }
    else if (r.place) { if (!r.gone) lightPlace(vp.viewer, r.place, geo, color, tag); for (const s of r.place.items.some((x) => x.kind === "cut") ? spots(key, 2) : []) vp.viewer.addMarker(s.p, color, tag, 2.2); }
    else for (const s of spots(key)) vp.viewer.addMarker(s.p, color, tag, 2.2);
  }
  const flash = (k) => { lightRegion(k, LIT.chosen, "bcpick"); setTimeout(() => { if (alive) vp.viewer.clearOverlays("bcpick"); }, 1400); };
  /** « Choisir dans la vue » : the next click on the part names the place — the face, the edge or the point under the pointer. */
  function pickRegion(hit) {
    if (!asking) return;
    const item = placeItem(vp.sel ? vp.sel.at(hit) : null, geo), k = item ? placeKey(st, [item], geo) : null;
    if (!k) { toast("Cliquez une face, une arête ou un point de la pièce. Une interface, ou tout un côté du produit, se choisit dans la liste.", "info", 4000); return; }
    const set = asking; asking = null; view.style.cursor = ""; set(k); flash(k);
  }
  /** A right click on the part : hold it there, push there, heat there — on what is selected : the face, the edge or the point under
      the pointer, or everything chosen with Ctrl + click. The load case is built where the designer points. */
  function placeMenu(hit, sel) {
    if (!model || !sel) return [];
    const items = sel.items().map((x) => placeItem(x, geo)).filter(Boolean); if (!items.length) return [];
    const name = placeLabel(items, geo), faces = placeHasFace({ items }), heat = st.kind === "thermal" || (st.kind === "thermo" && !st.thermo.uniform), sig = items.map((x) => x.sig).sort().join("|");
    const found = (Object.entries(st.places).find(([, p]) => p.items.map((x) => x.sig).sort().join("|") === sig) || [])[0], out = placeNormal({ items }, geo), cutItem = items.find((x) => x.kind === "cut"), cut = cutItem ? cuts().find((c) => c.axis === cutItem.axis) : null;
    const into = out ? pushInto(out) : cut ? { dir: `${cut.keep < 0 ? "-" : "+"}${"XYZ"[cut.axis]}` } : { dir: "-Z" };      // a new load pushes into the face it is put on
    const add = (list, fn, text, group) => () => { const k = placeKey(st, list, geo); fn(k); if (group) st.sel = `${group[0]}${st[group[1]].length}`; changed(); flash(k); toast(text, "success", 2500); toEnter(); };
    /* what is already there : set it or take it away from here, as in the Isolation */
    const here = found ? loadTree().flatMap((g) => g.items.filter((it) => it.region === found).flatMap((it) => [{ label: `Régler ${it.id} — ${it.text}`, icon: "edit", run: () => { select(it.id); toEnter(); } },
      { label: `Retirer ${it.id}`, icon: "trash", run: () => { st[g.key].splice(it.index, 1); st.sel = null; changed(); toast(`${it.id} retiré de ${name}`, "success", 2500); } }])) : [];
    const one = items.length === 1 && items[0].kind !== "point" && hit && hit.point ? placeItem({ kind: "point", at: hit.point.map((c) => Math.round(c * 100) / 100) }, geo) : null;
    return [{ title: name }, ...here, ...(here.length ? ["—"] : []),
      ...(st.kind !== "thermal" && !(found && st.fixed.some((x) => supportKey(x) === found)) ? [{ label: "Appui ici (encastrement)", icon: "lock", run: add(items, (k) => { st.fixed.push(k); }, `Appui sur ${name} : ses directions se règlent à gauche`, ["A", "fixed"]) }] : []),
      ...(st.kind === "structure" ? [{ label: "Effort ici : 100 N", icon: "bolt", run: add(items, (k) => { st.loads.push({ region: k, mode: "force", F: 100, ...into, p: 0.1, ask: ["F"] }); }, `Effort sur ${name} : entrez sa valeur et sa direction à gauche`, ["E", "loads"]) },
        ...(faces ? [{ label: "Pression ici : 0,1 MPa", icon: "flow", run: add(items, (k) => { st.loads.push({ region: k, mode: "pressure", F: 100, ...into, p: 0.1, ask: ["p"] }); }, `Pression sur ${name} : entrez sa valeur à gauche`, ["E", "loads"]) }] : []),
        ...(one ? [{ label: "Effort en ce point précis : 100 N", icon: "bolt", run: add([one], (k) => { st.loads.push({ region: k, mode: "force", F: 100, ...into, p: 0.1, ask: ["F"] }); }, "Effort en ce point : entrez sa valeur et sa direction à gauche", ["E", "loads"]) }] : [])] : []),
      ...(heat ? [{ label: "Source de chaleur ici : 5 W", icon: "thermal", run: add(items, (k) => { st.power.push({ region: k, P: 5, ask: ["P"] }); }, `Source sur ${name} : entrez sa puissance à gauche`, ["Q", "power"]) }, { label: "Température imposée ici : 25 °C", icon: "thermal", run: add(items, (k) => { st.fixedT.push({ region: k, T: 25, ask: ["T"] }); }, `Température imposée sur ${name} : entrez-la à gauche`, ["T", "fixedT"]) }] : [])];
  }
  /** The symbols of the load case : clamps where the product is held, arrows where it is pushed and which way, marks for heat —
      each in the colour of its type, with its number ; the labels of a type show when its eye is open, the selected item always. */
  const regionName = (k) => (regionOf(k) || { label: k }).label, loadTree = () => bcTree(st, regionName);
  /** What the case still lacks or gets wrong, as the guide lists it. */
  const issues = () => (whole ? [...caseIssues(st, { regionOk: (k) => { const r = regionOf(k); return !!r && !r.gone; }, regionName }), ...zoneIssues(st.zones, zoneInfo), ...sensorIssues(st.sensors, readings())].sort((a, b) => RANK[a.level] - RANK[b.level]) : []);
  /* brings the first value that waits to the eye of the designer : its field blinks in the left panel */
  const toEnter = () => setTimeout(() => { if (alive) nudge(left.querySelector(".bc-edit input.need")); }, 90);
  function drawSymbols() {
    const v = vp.viewer; v.clearOverlays("sym"); v.clearOverlays("bcsel"); if (!model) return;
    const tag = "sym", tree = loadTree();
    for (const g of tree) for (const it of g.items) {
      if (it.off) continue;      // put aside : no symbol — its place still lights up while it is selected
      if (it.kind === "symmetry") { for (const s of planeSpots(it.plane)) clamp(v, s.p, s.out, { tag, color: it.color }); continue; }
      if (it.kind === "fixed") for (const s of spots(it.region)) clamp(v, s.p, s.out, { tag, color: it.color });
      else if (it.kind === "pressure") for (const s of spots(it.region)) arrow(v, s.p, s.out.map((c) => -c), { tag, color: it.color, len: v._size() * 0.05 });
      else if (it.kind === "force") for (const s of spots(it.region, 2)) arrow(v, s.p, loadDir(st.loads[it.index]) || [0, 0, -1], { tag, color: it.color });
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
    if (!ok || !alive) return; st.cuts = st.cuts.filter((c) => c.bc !== "sym" || c.off); st.sel = null; outdate(); remesh(false); toast("Symétrie retirée : le produit entier est calculé.", "success", 3500);
  }
  /** Selects an item of the load case (null : none) : it lights up on the model and opens in the tree. */
  function select(id) { st.sel = id; drawLeft(); drawSymbols(); }

  /* ---------- geometry and mesh ---------- */
  let built = "";      // what the geometry was built from : an undo that changes it builds it again
  const shape = () => JSON.stringify([store.project.parts, store.project.assemblies]);
  async function loadGeometry() {
    const stop = () => { kernel.cancel(); setStatus("Construction annulée", ""); vp.setBusy("Construction annulée : rien à simuler pour l'instant.", { stopped: true, retry: loadGeometry }); };
    vp.setBusy("Construction de la géométrie…", { cancel: stop }); last = null; runs = []; st.view = "model"; built = shape();
    try {
      if (st.target.type === "part") {
        const built = await kernel.build(store.part(st.target.id));
        geo = { bodies: built.bodies.map((b) => ({ name: b.name, pos: b.mesh.pos, idx: b.mesh.idx, mesh: b.mesh, material: feaMaterial(b.material) })), interfaces: built.interfaces, material: store.part(st.target.id).material };
      } else {
        const ctx = await buildAssembly(store.assembly(st.target.id), (t, done, total) => vp.setBusy(t, { done, total, cancel: stop })), bodies = [];
        for (const inst of ctx.asm.instances) for (const b of ctx.built[inst.part].bodies) { const mesh = bakeMesh(b.mesh, ctx.sol.placements[inst.id]); bodies.push({ name: `${inst.part} · ${b.name}`, pos: mesh.pos, idx: mesh.idx, mesh, material: feaMaterial(b.material) }); }      // each part where its mates put it : the view and the solver work in the frame of the product
        geo = { bodies, interfaces: [] };
      }
      if (!alive) return;
      remesh(true);
    } catch (e) { if (e && e.cancelled) return; vp.setBusy(""); info.textContent = e.message; info.className = "chip bad"; }
  }
  function remesh(first) {
    { const live = cuts(), one = oneSymmetry(live); if (one.dropped.length) { st.cuts = st.cuts.map((c) => (c.off ? c : one.cuts[live.indexOf(c)])); if (!first) saveCase(); toast(`Une seule symétrie à la fois pour l'instant : le plan ${one.dropped.join(", ")} devient une coupe libre.`, "warn", 6000); } }
    try { whole = buildModel({ bodies: geo.bodies, target: st.cells, planes: cuts() }); model = reduceModel(whole, cuts()); syms = findSymmetries(whole); }
    catch (e) { vp.setBusy(""); info.textContent = e.message; info.className = "chip bad"; if (cuts().length) { const lastOn = cuts().pop(); toast(`${e.message} Le dernier plan est mis à Off.`, "warn", 6000); lastOn.off = true; if (!first) saveCase(); return remesh(first); } model = null; whole = null; drawRight(); return; }
    const b = whole.bbox, h = model.grid.h; checkPlaces(st, geo); rezone();
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
    if (!(st.fixed.length || st.loads.length || st.power.length || st.fixedT.length) || !st.fixed.every((x) => regionOf(supportKey(x)))) {            // a sensible first case: held at one end of the longest side, loaded at the other — only when nothing is set : a case whose supports were taken away keeps its efforts
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
  /** The model in the view : the part itself — its faces, edges and points are what one points at — cut where the model is cut ; over
      it the mesh, as fine lines ; the small cubes of the zones in their colour ; and the face of each cut, to point at it too. */
  function showMesh() {
    const v = vp.viewer, parts = zonePreps.filter((p) => p.prep).map((p) => ({ prep: p.prep, field: null, u: null })), s = parts.length ? compositeSkin(model, null, parts) : skin(model, null), fine = parts.reduce((n, p) => n + p.prep.local.nCells, 0);
    v.clear(); if (vp.sel) vp.sel.clear();
    geo.bodies.forEach((b, k) => v.add({ id: bodyId(k), name: b.name, mesh: clipMesh(b.mesh, cuts()) }));
    const flat = (c) => { const col = new Float32Array(s.pos.length); for (let i = 0; i < col.length; i += 3) col.set(c, i); return col; }, only = (keep) => { const idx = []; for (let f = 0; f < s.faces; f++) if (keep(f) && s.idx[6 * f] !== s.idx[6 * f + 1]) for (let i = 0; i < 6; i++) idx.push(s.idx[6 * f + i]); return Uint32Array.from(idx); };
    v.addField("fea", { pos: s.pos, idx: s.idx, col: flat([0.72, 0.72, 0.72]), epos: s.epos, faces: false, edgeOpacity: 0.13 });
    if (s.zone) { const idx = only((f) => s.zone[f] > 0); if (idx.length) v.addField("feazone", { pos: s.pos, idx, col: flat(ZONE_TINT), opacity: 0.55, lift: true }); }
    if (model.cut) { const cf = exposedFaces(model), on = cutFaces(model, cf), idx = only((f) => f < cf.count && on[f]); if (idx.length) v.addField(CUT_FIELD, { pos: s.pos, idx, col: flat([0.78, 0.84, 0.93]), pickable: true }); }
    showZones(); showSensors();
    info.textContent = `${model.cut ? `Modèle ${fraction(model.cut.copies)} · ` : ""}${model.nCells.toLocaleString("fr-CA")} cubes de ${fmt(model.grid.h, 2)} mm${fine ? ` + ${fine.toLocaleString("fr-CA")} cubes fins (${parts.length} zone${parts.length > 1 ? "s" : ""})` : ""} · ${model.nNodes.toLocaleString("fr-CA")} nœuds`; info.className = "chip";
  }
  /* ---------- the two views : the model with its conditions, the last result ---------- */
  /** The case or the mesh changed : the result is kept, said to be of before, and the model comes back to the view. */
  /* the case is written in the project as it changes : one undoable step each time (nothing is written when nothing changed) */
  const saveCase = () => { if (alive && st.target) store.commit(`Cas de charge : ${st.target.id}`, (x) => { withCase(x, st.target.id, st); }); };
  const outdate = () => { if (last) last.stale = true; st.view = "model"; saveCase(); };
  /* ---------- the cases of the model, under their names : one in use, the others kept as they were left ---------- */
  const caseNow = () => (caseList(store.project, st.target.id).find((x) => x.on) || {}).name || FIRST_CASE, sig = () => JSON.stringify(caseList(store.project, st.target.id).map((x) => [x.name, x.on]));
  const named = () => { const l = caseList(store.project, st.target.id); return l.length > 1 || l[0].name !== FIRST_CASE; };
  let caseSig = "";
  const enter = (c) => { takeCase(st, c); st.sel = null; if (last) last.stale = true; st.view = "model"; remesh(false); };      // another case on the screen : its planes and its mesh setting come with it
  async function newCase() {
    const from = caseNow(), name = await promptBox("Nouveau cas de charge", "Nom", freshCaseName(caseList(store.project, st.target.id)), `Une copie du cas « ${from} » : mêmes appuis, mêmes efforts, même maillage. Changez-y ce qui diffère ; « ${from} » est gardé tel qu'il est.`);
    if (!name || !alive) return; let made = null;
    store.commit(`Cas de charge : ${st.target.id} — nouveau cas « ${name.trim()} »`, (x) => { made = addCase(x, st.target.id, st, name); });
    if (!made) { toast(`Le nom « ${name.trim()} » est déjà pris, ou vide.`, "warn"); return; }
    drawLeft(); toast(`Cas « ${made} » en cours : une copie de « ${from} », qui est gardé tel qu'il est. Ctrl + Z pour revenir.`, "success", 5200);
  }
  function pickCase(name) { let took = null; store.commit(`Cas de charge : ${st.target.id} — cas « ${name} » en cours`, (x) => { took = useCase(x, st.target.id, st, name); }); if (took) { enter(took); toast(`Cas « ${name} » en cours. Ctrl + Z pour revenir.`, "success", 2800); } }
  async function nameCase(from) {
    const to = await promptBox("Renommer le cas de charge", "Nom", from); if (!to || !alive || to.trim() === from) return; let done = false;
    store.commit(`Cas de charge : ${st.target.id} — « ${from} » renommé « ${to.trim()} »`, (x) => { done = renameCase(x, st.target.id, st, from, to); });
    if (done) drawLeft(); else toast(`Le nom « ${to.trim()} » est déjà pris.`, "warn");
  }
  async function removeCase(name) {
    const one = caseList(store.project, st.target.id).length === 1;
    if (!(await confirmBox(one ? `Vider le cas « ${name} » ?` : `Retirer le cas « ${name} » ?`, one ? "Un modèle garde toujours un cas : ses appuis, ses efforts, ses zones et ses plans sont retirés, et il reprend le nom « Cas 1 ». Ctrl + Z les ramène." : "Ses appuis, ses efforts, ses zones et ses plans partent avec lui ; les autres cas ne changent pas. Ctrl + Z le ramène.", one ? "Vider" : "Retirer", true)) || !alive) return;
    let gone = null; store.commit(`Cas de charge : ${st.target.id} — cas « ${name} » retiré`, (x) => { gone = dropCase(x, st.target.id, st, name); });
    if (gone && gone.take) enter(gone.take); else drawLeft();
  }
  const drawSwitch = () => vp.setStatus(viewSwitch({ view: st.view, last, onView: setView }), info);
  function setView(v) {
    st.view = v === "result" && last && last.skin ? "result" : "model"; asking = null; askingPoint = null; view.style.cursor = "";
    const o = vp.viewer; o.clearOverlays("bc"); o.clearOverlays("bchover"); o.clearOverlays("bcsel");
    if (st.view === "result") { o.clear(); if (vp.sel) vp.sel.clear(); paint(); peak(); drawSymbols(); drawRight(); } else { showMesh(); refreshEstimate(); }      // the result is the mesh in colours ; the model is the part, to point at
    drawSwitch(); if (st.zones.length || st.sensors.length) drawLeft();      // the eye of the zones says what this view shows ; each instrument, what it reads on it
  }
  /* the worst point of the result shown, with its value : the peak stress or temperature, or the smallest safety factor */
  function peak() {
    const o = vp.viewer, thermal = last.kind === "thermal", p = thermal ? last.result.maxT : last.result.maxVm; o.clearOverlays("bc");
    if (!thermal && st.quantity === "fs" && last.fs) { const S = safetySummary(last.fs, st.fsTarget); if (S.min !== null && S.at >= 0) { const at = Array.from(last.skin.pos.subarray(3 * S.at, 3 * S.at + 3)); o.addMarker(at, "#ff5a4f", "bc", 1.8); o.addLabel(at, `FS ${Number.isFinite(S.min) ? show(S.min, 2) : "∞"}`, "bc", S.min < st.fsTarget ? "err" : ""); } return; }
    o.addMarker(p.at, "#ff5a4f", "bc", 1.8); o.addLabel(p.at, thermal ? `${show(p.value, 1)} °C` : `${show(p.value, 1)} MPa`, "bc", "err");
    if (thermal && isInfrared(st.palette)) { const q = last.result.minT; o.addMarker(q.at, "#38bdf8", "bc", 1.5); o.addLabel(q.at, `min ${show(q.value, 1)} °C`, "bc"); }      // as an infrared camera marks them : the hot spot and the cold spot
  }
  /** The simple regions of a choice: one for a face, one per screw for a bolted interface (the effort is shared between them). */
  const listOf = (key) => (regionOf(key) || regions[0]).list;
  /* a support : everything held, or only the directions it blocks */
  const supports = () => onOf(st.fixed).flatMap(([x]) => { const d = supportDofs(x); return listOf(supportKey(x)).map((region) => (d.every(Boolean) ? region : { region, dofs: d })); });
  const pushOf = (l, share) => (loadDir(l) || [0, 0, 0]).map((c) => c * l.F / share);
  function loadCase() {
    if (st.kind === "thermo") return { fixed: supports(), loads: [], Tref: st.thermo.Tref, thermal: st.thermo.uniform ? { uniform: st.thermo.T } : { case: thermalCase() } };
    return st.kind === "thermal" ? thermalCase() : structureCase();
  }
  function thermalCase() {
    return { power: onOf(st.power).flatMap(([x]) => listOf(x.region).map((region, i, all) => ({ region, P: x.P / all.length }))), fixedT: onOf(st.fixedT).flatMap(([x]) => listOf(x.region).map((region) => ({ region, T: x.T }))),
      convection: st.conv.on ? [{ region: "exterior", h: st.conv.h, Tamb: st.conv.Tamb }] : [] };
  }
  function structureCase() {
    return { fixed: supports(), loads: onOf(st.loads).flatMap(([l]) => listOf(l.region).map((region, i, all) => (l.mode === "pressure" ? { region, pressure: l.p } : { region, force: pushOf(l, all.length) }))) };
  }
  /** Is the case the same on both sides of a plane ? */
  function symmetric(plane) {
    const heat = st.kind === "thermal" || (st.kind === "thermo" && !st.thermo.uniform), entries = [];
    if (st.kind !== "thermal") { onOf(st.fixed).forEach(([x, i]) => listOf(supportKey(x)).forEach((region) => entries.push({ what: "appui", label: `Appui ${i + 1}`, region })));
      if (st.kind === "structure") onOf(st.loads).forEach(([l, i]) => listOf(l.region).forEach((region, j, all) => entries.push({ what: `effort ${l.mode}`, label: `Effort ${i + 1}`, region, vector: l.mode === "pressure" ? null : pushOf(l, all.length) }))); }
    if (heat) { onOf(st.power).forEach(([x, i]) => listOf(x.region).forEach((region) => entries.push({ what: "chaleur", label: `Source ${i + 1}`, region }))); onOf(st.fixedT).forEach(([x, i]) => listOf(x.region).forEach((region) => entries.push({ what: "température", label: `Température ${i + 1}`, region }))); }
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
      el("div", { class: "side-section", "data-fold-note": `${st.target.name} · ${{ structure: "structure", thermal: "thermique", thermo: "thermo-mécanique" }[st.kind]}` }, el("h3", null, "Modèle"), field("Ce que l'on simule", sel(st.target.id, targets.map((t) => [t.id, `${t.type === "part" ? "Pièce" : "Assemblage"} — ${t.name}`]), (id) => { st.target = targets.find((t) => t.id === id); st.from = `${store.project.id}:${id}`; st.sel = null; takeCase(st, caseOf(store.project, id)); loadGeometry(); })),
        field("Physique", sel(st.kind, [["structure", "Structure — efforts et déformations"], ["thermal", "Thermique — régime permanent"], ["thermo", "Thermo-mécanique — dilatation et contraintes"]], (k) => { st.kind = k; changed(); })),
        field("Finesse du maillage", el("input", { type: "range", min: 500, max: 16000, step: 500, value: st.cells, onChange: (e) => { st.cells = +e.target.value; outdate(); remesh(false); } }), `Environ ${st.cells.toLocaleString("fr-CA")} cubes : grossier et rapide. Les détails plus petits qu'un cube sont ignorés.`)));
    const sec = el("div", { class: "side-section" }); caseSig = sig();
    scroll.append(casesSection({ list: caseList(store.project, st.target.id, st), use: pickCase, add: newCase, rename: nameCase, drop: removeCase }), sec);
    if (whole) scroll.append(cutsSection({ st, kind: st.kind, syms, bbox: whole.bbox, symmetric, apply: () => { outdate(); remesh(false); } }),
      zonesSection({ st, preps: zonePreps, h: model.grid.h, model, apply: applyZones, shown: zonesOn(), result: st.view === "result", show: (on) => { st.show[st.view === "result" ? "zonesResult" : "zones"] = on; showZones(); drawLeft(); }, hover: (z) => { if (litZone !== z) { litZone = z; showZones(); } },
        aim: (set) => { if (st.view === "result") setView("model"); asking = null; askingPoint = set; view.style.cursor = "crosshair"; toast("Cliquez sur la pièce le point où centrer la zone.", "info", 4200); } }),
      sensorsSection({ st, kinds: sensorKinds(), rows: readings(), has: !!probeNow(), stale: !!(last && last.stale), shown: st.show.sensors !== false, show: (on) => { st.show.sensors = on; showSensors(); drawLeft(); }, apply: sensorsChanged, aim: aimSensor, hover: (s) => { if (litSensor !== s) { litSensor = s; showSensors(); } } }));
    const heat = st.kind === "thermal" || (st.kind === "thermo" && !st.thermo.uniform);
    if (st.sel && !bcFind(loadTree(), st.sel)) st.sel = null;
    const DEFAULT = { fixed: () => regions[0].key, loads: () => ({ region: regions[1].key, mode: "force", F: 100, dir: "-Z", p: 0.1, ask: ["F"] }), power: () => ({ region: regions[0].key, P: 5, ask: ["P"] }), fixedT: () => ({ region: regions[5].key, T: 25, ask: ["T"] }) };
    const aim = (set) => { if (st.view === "result") setView("model"); asking = set; view.style.cursor = "crosshair"; toast("Cliquez une face, une arête ou un point de la pièce : il s'allume sous le curseur. Caché ? Tournez la vue ou coupez-la.", "info", 4200); };
    const go = (x) => { if (x.id && !aside(x.id) && st.sel !== x.id) select(x.id); setTimeout(() => { if (alive) nudge(spot(x)); }, 90); };
    const found = issues(); setGuide(found.map((x) => ({ ...x, si: true, go: () => go(x) })));      // the guide of the top bar says the same
    sec.append(el("h3", null, "Conditions du cas"), ...[guideBox(found, { go, si: true })].filter(Boolean), bcSection({ st, tree: loadTree(), regions: [...regions, ...usedPlaces()], select, changed, aim, relabel: () => { drawLeft(); drawSymbols(); },
      hover: (k, color) => { vp.viewer.clearOverlays("bchover"); if (k && !asking) lightRegion(k, color || LIT.named, "bchover"); },
      add: (key) => { st[key].push(DEFAULT[key]()); const g = loadTree().find((x) => x.key === key), it = g.items[g.items.length - 1]; st.sel = it.id; changed(); aim((k) => { if (key === "fixed") st.fixed[it.index] = k; else st[key][it.index].region = k; changed(); toEnter(); }); },
      remove: (key, i) => { st[key].splice(i, 1); st.sel = null; changed(); }, unsym,
      toggle: (key, i, alone) => { if (alone) st[key] = soloOn(st[key], i, key); else st[key][i] = withOff(st[key][i], !isOff(st[key][i]), key); changed(); },
      copy: (key, i) => { st[key].splice(i + 1, 0, copyOf(st[key][i])); const it = loadTree().find((g) => g.key === key).items.find((x) => x.index === i + 1 && !x.locked); st.sel = it ? it.id : null; changed(); toast(`${it ? it.id : "La copie"} est une copie à Off : changez-y une valeur, puis mettez-la à On à la place de l'original.`, "info", 5200); } }),
      el("p", { class: "muted small" }, "La vue montre la pièce elle-même : un clic droit sur n'importe quelle face, arête ou point — intérieur aussi : tournez la vue, ou coupez-la — y pose un appui, un effort ou une source, et règle ou retire ce qui s'y trouve. Ctrl + clic en choisit plusieurs, pour une seule condition. Sur un modèle coupé, la face de coupe se pointe de même. Un effort prend la direction que vous lui donnez ; un appui bloque les directions cochées. Une valeur qui clignote est un exemple : entrez la vôtre."));
    if (st.kind === "thermo") sec.append(el("h3", { style: { marginTop: ".7rem" } }, "Température"),
      el("div", { class: "bc-row" }, el("small", null, "Montage sans contrainte à"), num(st.thermo.Tref, (v) => { st.thermo.Tref = v; changed(); }), el("small", null, "°C")),
      el("label", { class: "check" }, el("input", { type: "checkbox", checked: st.thermo.uniform, onChange: (e) => { st.thermo.uniform = e.target.checked; changed(); } }), "Pièce à température uniforme"),
      st.thermo.uniform ? el("div", { class: "bc-row" }, num(st.thermo.T, (v) => { st.thermo.T = v; changed(); }), el("small", null, "°C en service")) : el("p", { class: "muted small" }, "Le champ de température est d'abord calculé avec les sources ci-dessus, puis appliqué à la structure."));
    if (heat) sec.append(...[el("h3", { style: { marginTop: ".7rem" } }, "Convection sur l'extérieur"), el("label", { class: "check" }, el("input", { type: "checkbox", checked: st.conv.on, onChange: (e) => { st.conv.on = e.target.checked; changed(); } }), "Toutes les faces exposées"),
      st.conv.on ? el("div", { class: "bc-row" }, num(st.conv.h, (v) => { st.conv.h = v; changed(); }), el("small", null, "W/m²·K"), num(st.conv.Tamb, (v) => { st.conv.Tamb = v; changed(); }), el("small", null, "°C")) : null,
      el("p", { class: "muted small" }, "Air calme : 5 à 15 W/m²·K ; air soufflé : 25 à 100 ; plaque froide à eau : 500 et plus.")].filter(Boolean));
    const m = geo.bodies[0].material, nbc = loadTree().reduce((n, g) => n + g.items.filter((it) => !it.off).length, 0), nOff = loadTree().reduce((n, g) => n + g.items.filter((it) => it.off).length, 0);
    sec.setAttribute("data-fold-note", `${nbc ? `${nbc} condition${nbc > 1 ? "s" : ""}` : "aucune condition"}${nOff ? ` · ${nOff} à Off` : ""}`);      // what the group holds, read beside its title while it is folded
    scroll.append(el("div", { class: "side-section", "data-fold-note": geo.bodies.length > 1 ? `${geo.bodies.length} corps` : m.name }, el("h3", null, "Matériau"), el("p", { class: "small" }, geo.bodies.length > 1 ? `${geo.bodies.length} corps, chacun avec son matériau ; contacts collés, conduction parfaite.` : `${m.name} — E ${fmt(m.E / 1000, 1)} GPa, ν ${m.nu}, k ${fmt(m.k, 1)} W/m·K${m.alpha ? `, α ${fmt(m.alpha * 1e6, 1)} µm/m·K` : ""}${m.Re ? `, Re ${fmt(m.Re, 0)} MPa` : ""}.`),
      el("p", { class: "muted small" }, "Valeurs typiques : la fiche de la nuance fait foi.")));
  }

  /* ---------- right: the hand calculation first, then the simulation ---------- */
  function drawRight() {
    clear(right);
    right.append(el("div", { class: "side-head" }, el("h2", null, st.target.name)));
    const body = el("div", { class: "side-scroll" });
    right.append(body);
    if (!model || !estimate) { body.append(el("p", { class: "muted" }, "Préparation…")); return; }
    /* what one does stays at the top, in reach : launch, and go from the model to the result ; it does not scroll away */
    const go = btn(last ? "Relancer la simulation" : "Lancer la simulation", () => run(), { primary: true, icon: "play" }), wait = blocking(issues());
    const flip = last && last.skin ? btn(st.view === "result" ? "Revenir au modèle" : `Voir le résultat ${last.n}`, () => setView(st.view === "result" ? "model" : "result"), { icon: st.view === "result" ? "edit" : "eye", tip: st.view === "result" ? "Le modèle, ses appuis, ses efforts et leurs étiquettes : pour modifier le cas" : "Le dernier calcul, en couleurs" }) : null;
    right.insertBefore(el("div", { class: "side-actions" }, el("div", { class: "side-actions-row" }, go, flip),
      ...(wait.length ? [el("p", { class: "atelier-hint warn" }, icon("warning"), ` Avant de lancer — ${guideSummary(wait)}, dans le cas de charge à gauche.`)] : [])), body);
    /* then what one reads : the result first once there is one, the hand estimate it is checked against, the method */
    const hand = el("div", { class: "side-section", "data-fold-note": estimate.title }, el("h3", null, "Avant de calculer — l'estimation à la main"), el("p", { class: "small" }, el("b", null, estimate.title)),
      el("ol", { class: "calc-steps" }, estimate.steps.map((s) => el("li", null, s))), ...estimate.warnings.map((w) => el("p", { class: "atelier-hint warn" }, icon("warning"), " ", w)));
    const method = el("div", { class: "side-section" }, el("h3", null, "La méthode"), el("p", { class: "muted small" }, "Cubes identiques, hexaèdre à modes incompatibles (flexion juste même avec un élément dans l'épaisseur), gradient conjugué. Tout le code du solveur est dans ce dépôt, sous licence MIT."));
    const valid = validationSection({ ids: { structure: ["fea:structure"], thermal: ["fea:thermal"], thermo: ["fea:thermo", "fea:structure"] }[st.kind] || ["fea:structure"], redraw: drawRight });      // the published examples the solver was replayed against
    if (!last) { body.append(hand, method, valid); return; }
    const before = runs.filter((x) => x !== last && x.kind === last.kind && x.probe && x.n < last.n).pop();      // the trial before, of the same physics : what each instrument read then
    resultPanel(body, { last, st, runs, named: named(), mat: geo.bodies[0].material, keep, setView, saveCase, sensors: { sensors: st.sensors, rows: readings(), prev: before ? readSensors(before.probe, st.sensors) : null, prevN: before ? before.n : 0, thermo: last.kind === "thermo" },
      repaint: (only) => { if (st.view !== "result") { setView("result"); return; } paint(); peak(); if (!only) drawRight(); },
      pick: (x) => { last = x; setView("result"); } });
    body.append(hand, method, valid);
  }
  /** Paints the result : the stress (or the temperature) on the current scale — blue to red inside, magenta above, grey below — or the
      safety factor against the one aimed at — red below it, then orange, blue, green. */
  function paint() {
    if (!last || !last.skin) return;
    const s = last.skin, thermal = last.kind === "thermal", safety = st.quantity === "fs" && !thermal && last.fs, col = safety ? new Float32Array(s.pos.length) : fieldColours(s.val, last.range, thermal ? st.palette : "rainbow");
    if (safety) for (let i = 0; i < last.fs.length; i++) { const c = fsColour(last.fs[i], st.fsTarget); col[3 * i] = c[0]; col[3 * i + 1] = c[1]; col[3 * i + 2] = c[2]; }
    vp.viewer.addField("fea", { pos: s.pos, idx: s.idx, col, epos: thermal && isInfrared(st.palette) ? null : s.epos, pickable: true }); showZones(); showSensors();      // an infrared image shows no mesh
  }
  function run() {
    if (!model) return;
    const wait = blocking(issues());      // what must be entered or put right first : the guide takes the designer there
    if (wait.length) { const x = wait[0]; if (x.id && x.id[0] !== "Z") st.sel = x.id; drawLeft(); drawSymbols(); toast(`Avant de lancer : ${x.text}`, "warn", 8000); setTimeout(() => { if (alive) nudge(spot(x) || left.querySelector(".guide")); }, 90); return; }
    if (worker) worker.terminate();
    worker = new Worker(new URL("../analysis/fea/worker.js", import.meta.url), { type: "module" });
    const id = ++seq, kind = st.kind, est = estimate, ran = caseWords(loadTree(), liveZones(), cuts());      // the case as it is solved : what the trial remembers, to compare with the next
    const halt = () => { if (worker) { worker.terminate(); worker = null; } vp.setBusy(""); setStatus("Simulation annulée", ""); toast("Simulation annulée : le dernier résultat gardé reste affichable.", "info"); };
    vp.setBusy("Résolution…", { cancel: halt }); setStatus("Simulation en cours…", "busy");
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.id !== id || !alive) return;
      if (m.progress !== undefined) { vp.setBusy(`${m.progress.stage === "zones" ? "Résolution avec les zones de raffinement" : "Résolution"}… itération ${m.progress.iteration || ""}`, { cancel: halt }); return; }
      vp.setBusy(""); worker.terminate(); worker = null;
      if (!m.ok) { setStatus("Simulation impossible", "bad"); toast(m.error, "error", 9000); return; }
      const s = m.skin, lo = kind === "thermal" ? m.result.minT.value : 0, hi = kind === "thermal" ? m.result.maxT.value : m.result.maxVm.value;
      last = { n: (runs.length ? runs[runs.length - 1].n : 0) + 1, kind, stale: false, skin: s, data: [lo, hi > lo ? hi : lo + 1], range: [lo, hi > lo ? hi : lo + 1], result: m.result, info: m.info, compare: compare(kind, est, m.result), estimate: est,
        fs: kind !== "thermal" && s.re ? safetyField(s.val, s.re) : null, case: { ...ran, name: caseNow() }, probe: m.probe || null };
      runs.push(last); if (runs.length > 6) { runs[runs.length - 7].skin = null; runs[runs.length - 7].probe = null; }      // the six last trials can be shown again ; the older ones keep their figures
      setStatus(`Simulation : ${m.result.iterations} itérations, ${fmt(m.result.ms / 1000, 2)} s`, "done");
      setView("result");
    };
    worker.onerror = (e) => { vp.setBusy(""); setStatus("Simulation impossible", "bad"); toast(`Le solveur s'est arrêté : ${e.message || "erreur inconnue"}.`, "error", 9000); };
    worker.postMessage({ id, kind, bodies: geo.bodies.map(({ name, pos, idx, material }) => ({ name, pos, idx, material })), mesh: { target: st.cells, planes: cuts() }, cuts: cuts(), zones: liveZones().map(normZone).filter(Boolean), load: loadCase() });
  }
  function keep() {
    if (!last) return;
    const r = last.result, mat = geo.bodies[0].material, thermal = last.kind === "thermal", nominal = r.nominalVm ? r.nominalVm.value : null, read = keptSensors(readSensors(last.probe, st.sensors));
    store.commit(`Simulation gardée : ${st.target.id}`, (x) => { x.simulations = x.simulations || []; x.simulations.push({ id: `S${x.simulations.length + 1}`, kind: last.kind, target: st.target.id, ...(named() ? { case: last.case.name } : {}), cells: last.info.cells, h: last.info.h, ...(last.info.cuts ? { cuts: last.info.cuts, copies: last.info.copies } : {}),
      ...((r.zones || []).some((z) => !z.error) ? { zones: r.zones.filter((z) => !z.error).map((z) => ({ id: z.id, shape: z.shape, axis: z.axis, size: z.size, length: z.length, at: z.at, ratio: z.ratio, h: z.h, cells: z.cells, peak: z.peak.value, alone: z.alone ? z.alone.value : null })) } : {}),
      estimate: thermal ? { Tmax: last.estimate.values.Tmax } : { sigma: (last.kind === "thermo" && last.estimate.values.sigmaPlate) || last.estimate.values.sigma, delta: last.estimate.values.delta },
      result: thermal ? { Tmax: r.maxT.value, Tmin: r.minT.value } : { sigma: r.maxVm.value, nominal, delta: r.maxU.value, sf: mat.Re ? mat.Re / r.maxVm.value : null, ...(last.kind === "thermo" ? { Tmax: r.maxT.value, core: r.coreVm ? r.coreVm.value : null } : {}) },
      ...(read.length ? { sensors: read } : {}), worst: last.compare.rows.length ? last.compare.worst : null, verdict: last.compare.verdict, when: new Date().toISOString() }); });
    toast("Simulation ajoutée au rapport de revue.", "success");
  }

  vp.setStatus(info);                                    // whatever stops the first mesh is said in the view, before the switch of views exists
  loadGeometry();
  /* Ctrl + Z, Ctrl + Y : the case comes back as the project has it now ; anything else that was undone is built again */
  /* …and the same when an AI answer is applied to the case (e.external : core/ai_more.js) */
  const unsee = store.on("change", (e) => { if (!alive || !e || !(e.undo || e.external) || !geo) return; const kept = takeCase({}, caseOf(store.project, st.target.id)), moved = !sameCase(kept, st), rebuilt = shape() !== built;
    if (!moved && !rebuilt) { if (sig() !== caseSig) drawLeft(); return; }
    if (moved && !rebuilt && sameSolve(kept, st)) { st.sensors = kept.sensors; drawLeft(); showSensors(); if (last) drawRight(); return; }      // only the instruments came back : the result stands
    if (moved) { takeCase(st, kept); st.sel = null; }
    if (rebuilt) loadGeometry(); else { if (last) last.stale = true; st.view = "model"; remesh(false); } });
  return () => { alive = false; unsee(); if (worker) worker.terminate(); vp.dispose(); };
}

registerModule({ key: "fea", label: "Simulation", icon: "physics", hidden: true, tip: "Éléments finis simplifiés, structure et thermique, recoupés par un calcul à la main", render });
