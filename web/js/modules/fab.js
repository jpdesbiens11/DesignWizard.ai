/* DesignWizard.ai — the virtual fabrication shop (point 13 of the roadmap, JP : « un genre d'atelier de fab virtuel, une gamme de fab visuelle,
   de la réception du brut au nettoyage et à l'ébavurage » ; choix cliqué : l'écran s'ouvre sur la gamme par défaut). The routing of a part
   (cad/process_plan.js), played step by step : in the centre, the part as it stands after each phase, turned toward the tool and set in the
   fixture of its station — made by the tool (core/fab_scene.js), a set-up of PRINCIPLE ; on the left, the flow, whose steps are dragged to
   another place (plan.order) ; on the right, the step : holding, operations, tools, checks, measures, the note of the shop, the supplier's answer.
   JP, 21 novembre : only what can be shown right is played — machined, moulded or cast, extruded, stamped or laser-cut parts (core/fab_path.js) ;
   the tool moves only where the part is machined, along a tool path WRITTEN BY AN AI through the round trip of the part, read and checked here.
   Out : the routing in Word / PDF, its deck (.pptx) with a box for the supplier on each slide, its film (.webm). */

import { el, btn, icon, badge, toast, fmtDims, fmtMass } from "../core/dom.js";
import { registerModule, go, setStatus, setGuide, app } from "../core/app.js";
import { store } from "../core/store.js";
import { kernel } from "../cad/client.js";
import { createViewport, showBuilt } from "../core/viewport.js";
import { pickList } from "../core/pick_list.js";
import { partGroups } from "../core/part_groups.js";
import { processPlan, stateSpec } from "../cad/process_plan.js";
import { sceneOf, fixtureMeshes, toStation, dirToStation } from "../core/fab_scene.js";
import { flatOf, flatSpec } from "../core/flat_pattern.js";
import { flowKeys, moveKey, dropKey, orderIssues, stepMeasures, emptyState, blankSpec } from "../core/fab_flow.js";
import { fabPlayable, toolMoves, passesOf, pathIssues, faceOf, timeline, tipAt, pathAsk, FAB_TOOLS } from "../core/fab_path.js";
import { cylMesh } from "../analysis/physics/scene3d.js";
import { planBar, shot, setPlanNote, planAiHelp } from "./plan_view.js";
import { fabDeck, recordFilm, measureWords } from "./fab_out.js";

const ICON = { saw: "saw", laser: "laser", mould: "cast", print: "layers", extrude: "extrusion", panel: "pcb", mill: "mill", lathe: "lathe", drill: "drill", brake: "bend", bench: "deburr", tank: "palette", metrology: "ruler", carton: "folder" };
const NORMAL = { "+X": [1, 0, 0], "-X": [-1, 0, 0], "+Y": [0, 1, 0], "-Y": [0, -1, 0], "+Z": [0, 0, 1], "-Z": [0, 0, -1] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** A matrix (column-major) that stands the local Z of a tool along `w`, its tip at p. */
function alignZ(w, p) {
  const n = Math.hypot(...w) || 1, z = w.map((x) => x / n), a = Math.abs(z[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = [a[1] * z[2] - a[2] * z[1], a[2] * z[0] - a[0] * z[2], a[0] * z[1] - a[1] * z[0]], m = Math.hypot(...u), x = u.map((q) => q / m), y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return [...x, 0, ...y, 0, ...z, 0, ...p, 1];
}
/** The parts not played, with why — said on the screen, never played wrong. */
function notPlayed() {
  const off = store.parts.filter((p) => !p.study && !fabPlayable(p).ok); if (!off.length) return null;
  return el("div", { class: "side-section", "data-fab-off": "", "data-fold-note": `${off.length} pièce(s)` }, el("h3", null, "Ne se jouent pas ici"),
    el("p", { class: "muted small" }, "L'atelier montre ce qu'il sait montrer juste : pièces usinées, moulées ou coulées, extrudées, embouties ou découpées au laser. Les autres gardent leur gamme écrite, dans l'onglet « Gamme » de la pièce."),
    el("ul", { class: "small fab-off" }, off.map((p) => el("li", null, el("b", null, p.id), ` — ${fabPlayable(p).short}`))));
}

function render(main, args) {
  const list = store.parts.filter((p) => fabPlayable(p).ok), asked = args[0] ? store.part(args[0]) : null, id = asked ? (fabPlayable(asked).ok ? asked.id : null) : (list[0] && list[0].id) || null;
  const left = el("aside", { class: "side" }), right = el("aside", { class: "side right" }), view = el("div"), root = el("div", { class: "studio fab" }, left, view, right);
  main.append(root); left.append(el("div", { class: "side-head" }, el("h2", null, "Atelier de fab")));
  const picker = () => (list.length ? pickList({ label: "Pièce fabriquée", value: id, groups: partGroups(list), onPick: (pid) => go(`#/fab/${encodeURIComponent(pid)}`) }) : null);
  if (!id) {
    root.classList.add("no-right"); right.remove(); left.append(el("div", { class: "side-actions" }, picker()), el("div", { class: "side-scroll" }, notPlayed()));
    const why = asked ? fabPlayable(asked).why : "";
    view.append(el("div", { class: "page" }, el("div", { class: "empty", "data-fab-not": asked ? asked.id : "" }, el("h2", null, asked ? `${asked.id} ne se joue pas à l'atelier` : "Aucune pièce à jouer"),
      el("p", null, asked ? `${why.charAt(0).toUpperCase()}${why.slice(1)}. L'atelier ne montre pas une gamme qu'il ne sait pas montrer juste ; la gamme écrite reste dans l'onglet « Gamme » de la pièce.` : "L'atelier joue les pièces usinées, moulées ou coulées, extrudées, embouties ou découpées au laser : créez-en une dans l'Atelier."),
      asked ? el("a", { class: "btn btn-primary", href: `#/parts/${encodeURIComponent(asked.id)}` }, "Ouvrir la pièce") : el("a", { class: "btn btn-primary", href: "#/shop" }, "Ouvrir l'Atelier"))));
    return null;
  }
  const vp = createViewport(view, { select: false, name: () => id }), cap = el("span", { class: "chip stage", "data-fab-caption": "" }, "—");
  vp.setStatus(cap);
  const st = { plan: null, built: null, i: 0, states: new Map(), blank: new Set(), token: 0, anim: 0, playing: false, busy: false, sc: null };
  const spec = () => store.part(id), lathe = () => spec().process === "cnc_turning", scene = (i) => { const b = st.states.get(i) || st.built; return sceneOf(st.plan.phases[i], spec().process, b.bbox); };
  const caption = (i) => { const ph = st.plan.phases[i], sc = scene(i); return `${ph.n} — ${ph.title} · ${sc.station.label}`; };
  const before = async (i) => (i > 0 ? stateOf(i - 1) : st.built);
  async function stateOf(i) {
    if (st.states.has(i)) return st.states.get(i);
    const bendAt = st.plan.phases.findIndex((p) => p.key === "bend"), flat = bendAt > i ? flatOf(spec(), st.built) : null;      // a folded part is a flat blank until its bending phase
    const sp = flat ? flatSpec(flat, spec()) : stateSpec(spec(), st.plan, i); let b = sp ? await kernel.build(sp, null, `${id}~fab${flat ? "flat" : i}`) : st.built;
    if (emptyState(b)) { b = await kernel.build(blankSpec(spec(), st.built), null, `${id}~fabblank`); st.blank.add(i); }      // the whole shape is machined : the part stands as its blank
    st.states.set(i, b); return b;
  }
  /** Paints step i : the part as it stands (after the phase, or o.pre : before it), placed for the tool, and the fixture of its station. → its measures */
  async function show(i, o = {}) {
    const token = st.token, b = o.pre || (await stateOf(i)); if (token !== st.token) return null;
    st.i = i; const sc = (st.sc = sceneOf(st.plan.phases[i], spec().process, b.bbox)), v = vp.viewer;
    if (!o.keep) v.clearOverlays("fab-path"); for (const k of [...v.objects.keys()]) v.remove(k);
    showBuilt(v, b, { prefix: "fab-part", matrix: sc.place.matrix, pickable: false });
    for (const m of fixtureMeshes(sc.solids)) v.add(m);
    if (o.fit !== false) v.fit(1.35); v.invalidate(); cap.textContent = caption(i);
    drawFlow(); drawRight(); return stepMeasures(b);
  }
  const stop = () => { st.anim++; st.playing = false; };
  const goTo = (i) => { const was = st.playing; stop(); show(i); if (was) drawLeft(); };
  const hasPath = (i) => toolMoves(spec(), st.plan.phases[i]) && passesOf(spec(), st.plan.phases[i].key).length > 0;
  const pathNote = (i) => { const ps = hasPath(i) ? passesOf(spec(), st.plan.phases[i].key) : [], by = [...new Set(ps.map((p) => p.by).filter(Boolean))].join(", ");
    return ps.length ? `Parcours d'outil (${ps.map((p) => `${(FAB_TOOLS[p.tool] || {}).label || p.tool} Ø${String(p.d).replace(".", ",")}`).join(", ")}) écrit par ${by || "une IA"} : une intention, pas un programme de machine.` : ""; };
  /** The machining of phase i : the part as it was before, the tool along the path the AI wrote, then the part after. → true when it ran to the end */
  async function machine(i) {
    const ph = st.plan.phases[i], passes = passesOf(spec(), ph.key); if (!toolMoves(spec(), ph) || !passes.length) return false;
    const pre = await before(i);
    if (pathIssues(passes, { bbox: pre.bbox, face: faceOf(ph.key), lathe: lathe() }).some((x) => x.level === "error")) { toast(`Phase ${ph.n} : le parcours d'outil ne se lit pas — le guide dit pourquoi.`, "warn", 6000); return false; }
    const run = ++st.anim; await show(i, { pre, fit: false }); if (run !== st.anim) return false;
    const v = vp.viewer, M = st.sc.place.matrix, face = NORMAL[faceOf(ph.key)];
    for (const k of ["cutter", "spindle", "drill", "tool"]) v.setVisible(`fab/${k}`, false);      // the still tools of the station give way to the one that moves
    for (const ps of passes) { let line = [], g = null; const T = FAB_TOOLS[ps.tool], flush = () => { if (line.length > 1) v.addPath(line, g ? T.color : "#64748b", "fab-path", 0.45, !g); };
      ps.moves.forEach((m) => { const p = toStation(M, m.slice(1)); if (m[0] !== g) { const last = line[line.length - 1]; flush(); line = last ? [last] : []; g = m[0]; } line.push(p); }); flush(); }
    const tl = timeline(passes), k = Math.max(1, tl.T / 18); let cur = -1, axis = [0, 0, 1];
    const tool = (ps) => { const T = FAB_TOOLS[ps.tool], r = T.axial ? ps.d / 2 : 2.5, L = T.axial ? Math.max(12, 3 * ps.d) : 22;
      axis = T.axial || !lathe() ? dirToStation(M, face) : [0, 1, 0];
      v.remove("fab/tool-bit"); v.remove("fab/tool-holder");
      v.add({ id: "fab/tool-bit", name: `${T.label} Ø${ps.d}`, mesh: cylMesh([0, 0, 0], [0, 0, L], r, 24), color: T.color, pickable: false });
      v.add({ id: "fab/tool-holder", name: "Porte-outil", mesh: cylMesh([0, 0, L], [0, 0, L + 30], Math.max(r + 2, 6), 24), color: "#7c8a99", pickable: false });
      cap.textContent = `${caption(i)} · ${T.label} Ø${String(ps.d).replace(".", ",")}`; };
    await new Promise((done) => { const t0 = performance.now(); const tick = (now) => { if (run !== st.anim) return done();
      const t = Math.min(tl.T, ((now - t0) / 1000) * k), at = tipAt(tl, t);
      if (at) { if (at.k !== cur) { cur = at.k; tool(passes[cur]); } const m = alignZ(axis, toStation(M, at.p)); v.setMatrix("fab/tool-bit", m); v.setMatrix("fab/tool-holder", m); v.invalidate(); }
      if (t >= tl.T) return done(); requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    v.remove("fab/tool-bit"); v.remove("fab/tool-holder");
    if (run !== st.anim) return false;
    await show(i, { fit: false, keep: true }); return true;      // the part after the phase, the path still drawn on it
  }
  async function play() {
    if (st.playing) { stop(); drawLeft(); return; }
    st.playing = true; drawLeft();
    for (let i = st.i >= st.plan.phases.length - 1 ? 0 : st.i; i < st.plan.phases.length && st.playing; i++) {
      const did = hasPath(i) ? await machine(i) : false; if (!st.playing) break;
      if (!did) { await show(i); await sleep(2400); } else await sleep(900);
    }
    st.playing = false; drawLeft();
  }
  async function load() {
    const token = ++st.token; st.states.clear(); st.blank.clear(); vp.setBusy("Gamme de la pièce, et la pièce telle qu'elle est après chaque phase…");
    try { st.built = await kernel.build(spec(), undefined, id); if (token !== st.token) return; st.plan = processPlan(spec(), st.built); vp.setBusy(""); await show(Math.min(st.i, st.plan.phases.length - 1)); setStatus(`Atelier : ${id}, ${st.plan.phases.length} phases`, "done"); }
    catch (e) { vp.setBusy(""); setStatus(`${id} : ${e.message}`, "bad"); }
  }
  const saveOrder = (keys, label) => store.updatePart(id, (x) => { x.plan = { ...(x.plan || {}), order: keys }; }, `${id} : atelier — ${label}`);
  const flowBox = el("div", { class: "fab-flow", role: "list", "aria-label": "Les étapes de la gamme, dans l'ordre" }), scroll = el("div", { class: "side-scroll" }), actions = el("div", { class: "side-actions" });
  left.append(actions, scroll);
  function drawLeft() {
    actions.replaceChildren(picker(), el("div", { class: "form-actions" }, btn("", () => st.plan && goTo(Math.max(0, st.i - 1)), { small: true, icon: "chevron-right", cls: "flip", tip: "Étape précédente (←)" }),
      btn(st.playing ? "Pause" : "Jouer la gamme", play, { small: true, primary: true, icon: "play", tip: "Les étapes l'une après l'autre, de la réception du brut à l'emballage ; l'outil usine là où un parcours est écrit" }), btn("", () => st.plan && goTo(Math.min(st.plan.phases.length - 1, st.i + 1)), { small: true, icon: "chevron-right", tip: "Étape suivante (→)" })));
    drawFlow();
  }
  function drawFlow() {
    if (!st.plan) return; const keys = flowKeys(st.plan), custom = !!(spec().plan && spec().plan.order); let drag = null;
    flowBox.replaceChildren(...st.plan.phases.map((ph, i) => { const sc = sceneOf(ph, spec().process, (st.states.get(i) || st.built).bbox), moving = hasPath(i);
      return el("div", { class: `fab-step${i === st.i ? " on" : ""}`, role: "listitem", draggable: "true", "data-step": ph.key, "aria-current": i === st.i ? "step" : null,
        onClick: () => goTo(i), onDragstart: (e) => { drag = ph.key; e.dataTransfer.effectAllowed = "move"; }, onDragover: (e) => e.preventDefault(), onDrop: (e) => { e.preventDefault(); if (drag && drag !== ph.key) saveOrder(dropKey(keys, drag, ph.key), `« ${ph.title} » déplacée`); } },
        el("span", { class: "fab-n" }, String(ph.n)), icon(ICON[sc.kind] || "gamme"), el("span", { class: "grow" }, el("b", null, ph.title), el("small", null, sc.station.label, moving ? " · parcours d'outil" : "")),
        ...[[-1, "Monter"], [1, "Descendre"]].map(([d, t]) => { const nk = moveKey(keys, ph.key, d); return el("button", { class: "icon-btn", type: "button", disabled: !nk, "aria-label": `${t} « ${ph.title} »`, "data-tip": `${t} dans la gamme`, onClick: (e) => { e.stopPropagation(); if (nk) saveOrder(nk, `« ${ph.title} » ${d < 0 ? "avancée" : "reculée"}`); } }, icon(d < 0 ? "chevron-right" : "chevron-down")); })); }));
    scroll.replaceChildren(el("div", { class: "side-section", "data-fold-note": `${st.plan.phases.length} étapes` }, el("h3", null, "La gamme, étape par étape"),
      el("p", { class: "muted small" }, "Glissez une étape pour en changer l'ordre (ou ses flèches) : l'ordre est gardé avec la pièce, et le guide dit ce qu'il dérange."), flowBox,
      custom ? btn("Revenir à l'ordre de l'outil", () => store.updatePart(id, (x) => { if (x.plan) delete x.plan.order; }, `${id} : atelier — ordre de l'outil`), { small: true, icon: "undo" }) : null),
      el("div", { class: "side-section" }, el("h3", null, "Partager avec le fournisseur"),
        el("div", { class: "form-actions" }, btn("Diaporama (.pptx)", (e, b) => out(b, () => fabDeck({ plan: st.plan, spec: spec(), viewer: vp.viewer, show: (i) => show(i), scene, pathNote }), "diaporama"), { small: true, primary: true, icon: "download", tip: "Une diapositive par étape : l'image, les opérations, les mesures, et une case où le fournisseur écrit sa réponse" }),
          btn("Film (.webm)", (e, b) => out(b, () => recordFilm({ viewer: vp.viewer, steps: st.plan.phases.length, show: (i) => show(i), play: (i) => (hasPath(i) ? machine(i) : null), caption, name: id }), "film"), { small: true, icon: "camera", tip: "Les étapes filmées l'une après l'autre, l'outil qui usine là où un parcours est écrit, leur titre incrusté dans l'image" })),
        planBar(st.plan, { aiKey: `part:${id}`, figures: async () => { const shots = []; for (let i = 0; i < st.plan.phases.length; i++) { await show(i); shots.push(shot(vp.viewer, caption(i), st.plan.phases[i].key)); } return shots; } })),
      notPlayed());
    const paths = st.plan.phases.map((ph, i) => (hasPath(i) ? pathIssues(passesOf(spec(), ph.key), { bbox: (st.states.get(i - 1) || st.built).bbox, face: faceOf(ph.key), lathe: lathe() }).map((x) => ({ level: x.level, text: `${id} — parcours d'outil de la phase ${ph.n} : ${x.text}`, field: ph.key })) : [])).flat();
    setGuide([...orderIssues(st.plan, id), ...paths].map((x) => ({ ...x, go: () => { const n = flowBox.querySelector(`[data-step="${x.field}"]`); if (n) n.scrollIntoView({ block: "center" }); } })).concat(
      st.plan.phases.length < 3 ? [{ level: "tip", text: `${id} — atelier : la pièce prend forme d'un coup (${spec().process || "procédé à choisir"}) : les étapes qui suivent montrent la pièce finie.` }] : []));
  }
  async function out(b, fn, what) { if (st.busy) return; st.busy = true; b.disabled = true; stop(); const back = st.i;
    try { await fn(); } catch (e) { console.error(e); toast(`Atelier, ${what} : ${e.message}`, "error", 7000); } finally { st.busy = false; b.disabled = false; await show(back); } }
  /** The tool path of a machining phase : what the AI wrote, checked ; or the request, ready for Claude. */
  function pathSection(ph) {
    if (!toolMoves(spec(), ph)) return null;
    const i = st.plan.phases.indexOf(ph), passes = passesOf(spec(), ph.key), pre = (i > 0 && st.states.get(i - 1)) || st.built, issues = passes.length ? pathIssues(passes, { bbox: pre.bbox, face: faceOf(ph.key), lathe: lathe() }) : [];
    const ask = () => { const a = pathAsk(spec(), ph, (st.built.facts || {}).holes, pre.bbox, lathe()), h = planAiHelp(st.plan); return app.aiLoop && app.aiLoop(`part:${id}`, { ask: a.ask, help: [...h.help, ...a.help], context: h.context }); };
    const by = [...new Set(passes.map((p) => p.by).filter(Boolean))].join(", ");
    return el("div", { class: "side-section", "data-fab-path": ph.key }, el("h3", null, "Parcours d'outil"),
      passes.length ? el("ol", { class: "plan-ops" }, passes.map((p) => { const T = FAB_TOOLS[p.tool]; return el("li", null, el("b", null, T ? T.label : p.tool), ` Ø${String(p.d).replace(".", ",")} — ${T ? T.fr : "outil inconnu"}, ${p.moves.length} positions`, p.note ? el("small", null, ` — ${p.note}`) : null); }))
        : el("p", null, "L'outil sait animer un parcours, il ne l'écrit pas : demandez-le à Claude (ou à l'IA de votre choix). La demande est prête — la phase, ses perçages, le repère et le format ; la réponse revient avec l'aperçu des changements."),
      passes.length && by ? el("p", { class: "muted small" }, `Écrit par : ${by}.`) : null,
      ...issues.map((x) => el("p", { class: `atelier-hint ${x.level === "error" ? "warn" : ""}` }, x.text)),
      el("div", { class: "form-actions" }, passes.length ? btn("Usiner", () => { const was = st.playing; stop(); if (was) drawLeft(); machine(i); }, { small: true, primary: true, icon: "play", disabled: issues.some((x) => x.level === "error"), tip: "La pièce d'avant la phase, l'outil le long du parcours, puis la pièce d'après" }) : null,
        btn(passes.length ? "Redemander à l'IA" : "Demander le parcours à Claude", ask, { small: true, primary: !passes.length, icon: "sparkle", tip: "Le bouton IA, avec la demande du parcours de cette phase déjà écrite" })),
      el("p", { class: "muted small" }, "Un parcours d'IA n'est pas un programme de machine : ni vitesses ni avances réelles, ni compensation de rayon, ni collision du porte-outil ; l'enlèvement de matière n'est pas simulé — la pièce passe de son état d'avant à celui d'après."));
  }
  function drawRight() {
    if (!st.plan) return; const ph = st.plan.phases[st.i], b = st.states.get(st.i) || st.built, prev = st.i ? st.states.get(st.i - 1) : null, sc = scene(st.i), m = stepMeasures(b), pm = prev ? stepMeasures(prev) : null, cm = ((spec().plan || {}).comments || {})[ph.key] || "";
    const area = (key, value, label, placeholder, write) => { const t = el("textarea", { rows: 3, "data-fab": key, "aria-label": label, placeholder, onChange: (e) => write(e.target.value) }); t.value = value; return t; };
    right.replaceChildren(el("div", { class: "side-head" }, el("h2", null, `${ph.n} — ${ph.title}`)), el("div", { class: "side-scroll" },
      el("div", { class: "side-section" }, el("h3", null, "Le poste"), el("p", null, icon(ICON[sc.kind] || "gamme"), " ", el("b", null, sc.station.label), " — ", sc.station.fr),
        el("p", { class: "muted small" }, "Montage de PRINCIPE, dessiné par l'outil : il dit l'intention ; l'atelier choisit son montage, ses outils et ses machines."),
        st.blank.has(st.i) ? el("p", { class: "atelier-hint", "data-fab-blank": "" }, "Brut SUPPOSÉ : la pièce ne dit pas sa matière première, et toute sa forme vient de l'usinage — l'atelier montre la boîte de la pièce ; au tour, une barre (un tube si la pièce est creuse de bout en bout) avec 1 mm de surépaisseur.") : null, ph.hold ? el("p", null, el("b", null, "Prise de pièce : "), ph.hold) : null, ph.outsourced ? badge("sous-traité", "warn") : null),
      pathSection(ph),
      el("div", { class: "side-section" }, el("h3", null, `Opérations (${ph.ops.length})`), ph.ops.length ? el("ol", { class: "plan-ops" }, ph.ops.map((op) => el("li", null, el("b", null, op.n), ` ${op.text}`, op.tools.length ? el("small", null, ` — ${op.tools.join(", ")}`) : null))) : el("p", { class: "muted small" }, "Aucune opération : une phase de contrôle ou d'expédition."),
        ph.checks.length ? el("ul", { class: "plan-checks" }, ph.checks.map((c) => el("li", null, c))) : null),
      el("div", { class: "side-section", "data-fab-measures": "" }, el("h3", null, "Ce que la pièce mesure après cette phase"), ...measureWords(m).map((t) => el("p", null, t)),
        pm && m && (pm.size.join() !== m.size.join() || pm.mass !== m.mass) ? el("p", { class: "muted small" }, `Avant : ${fmtDims(pm.size, 1)}${pm.mass ? `, ${fmtMass(pm.mass)}` : ""} — la phase a changé la pièce.`) : null),
      el("div", { class: "side-section" }, el("h3", null, "Note de l'atelier"), area("note", ph.note || "", "Note de l'atelier pour cette phase", "Ce que l'atelier propose, ce qui est convenu…", (v) => store.updatePart(id, (x) => setPlanNote(x, ph.key, v), `${id} : note de la phase ${ph.n}`))),
      el("div", { class: "side-section" }, el("h3", null, "Réponse du fournisseur"), area("comment", cm, "Réponse du fournisseur pour cette phase", "Le fournisseur écrit ici, ou dans la case de sa diapositive…", (v) => store.updatePart(id, (x) => { const p = (x.plan = x.plan || {}); p.comments = { ...(p.comments || {}) }; if (v.trim()) p.comments[ph.key] = v.trim(); else delete p.comments[ph.key]; if (!Object.keys(p.comments).length) delete p.comments; }, `${id} : réponse du fournisseur, phase ${ph.n}`)))));
  }
  const key = (e) => { if (e.target.closest && e.target.closest("input, textarea, select") || !st.plan) return; if (e.key === "ArrowRight") goTo(Math.min(st.plan.phases.length - 1, st.i + 1)); else if (e.key === "ArrowLeft") goTo(Math.max(0, st.i - 1)); };
  document.addEventListener("keydown", key);
  const off = store.on("change", () => { if (!store.part(id)) { go("#/fab"); return; } stop(); load(); });
  drawLeft(); load();
  return () => { off(); st.token++; stop(); document.removeEventListener("keydown", key); setGuide([]); };
}

registerModule({ key: "fab", label: "Atelier de fab", icon: "mill", tip: "La gamme d'une pièce usinée, moulée, extrudée, emboutie ou découpée au laser, jouée à l'atelier : chaque étape dans son montage, l'outil qui usine le long d'un parcours écrit par une IA ; diaporama et film pour le fournisseur", render });
