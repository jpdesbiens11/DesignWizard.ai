/* DesignWizard.ai — the virtual fabrication shop (point 13 of the roadmap, JP : « un genre d'atelier de fab virtuel… une gamme de fab visuelle,
   de la réception du brut au nettoyage et à l'ébavurage… pour montrer l'intention de fabrication aux étudiants, aux stagiaires et aux
   fournisseurs » ; choix cliqué : l'écran s'ouvre sur la gamme par défaut). The routing of a part (cad/process_plan.js), played step by step :
   in the centre, the part as it stands after each phase, turned toward the tool and set in the fixture of its station — made by the tool
   (core/fab_scene.js), a set-up of PRINCIPLE ; on the left, the flow, whose steps are dragged to another place (plan.order) ; on the right, the
   step : how the part is held, the operations, the tools, the checks, what it measures now, the note of the shop and the supplier's answer.
   Out : the routing in Word / PDF, its deck (.pptx) with a box for the supplier on each slide, its film (.webm). */

import { el, btn, icon, badge, toast, fmtDims, fmtMass } from "../core/dom.js";
import { registerModule, go, setStatus, setGuide } from "../core/app.js";
import { store } from "../core/store.js";
import { kernel } from "../cad/client.js";
import { createViewport, showBuilt } from "../core/viewport.js";
import { pickList } from "../core/pick_list.js";
import { partGroups } from "../core/part_groups.js";
import { processPlan, stateSpec } from "../cad/process_plan.js";
import { sceneOf, fixtureMeshes } from "../core/fab_scene.js";
import { flatOf, flatSpec } from "../core/flat_pattern.js";
import { flowKeys, moveKey, dropKey, orderIssues, stepMeasures } from "../core/fab_flow.js";
import { planBar, shot, setPlanNote } from "./plan_view.js";
import { fabDeck, recordFilm, measureWords } from "./fab_out.js";

const ICON = { saw: "saw", laser: "laser", mould: "cast", print: "layers", extrude: "extrusion", panel: "pcb", mill: "mill", lathe: "lathe", drill: "drill", brake: "bend", bench: "deburr", tank: "palette", metrology: "ruler", carton: "folder" };
const parts = () => store.parts.filter((p) => !p.step && !p.purchased && !p.study);

function render(main, args) {
  const list = parts(), id = args[0] && list.some((p) => p.id === args[0]) ? args[0] : (list[0] && list[0].id) || null;
  const left = el("aside", { class: "side" }), right = el("aside", { class: "side right" }), view = el("div"), root = el("div", { class: "studio fab" }, left, view, right);
  main.append(root); left.append(el("div", { class: "side-head" }, el("h2", null, "Atelier de fab")));
  if (!id) { root.classList.add("no-right"); right.remove(); view.append(el("div", { class: "page" }, el("div", { class: "empty" }, el("h2", null, "Aucune pièce à fabriquer"), el("p", null, "L'atelier joue la gamme d'une pièce : créez-en une dans l'Atelier."), el("a", { class: "btn btn-primary", href: "#/shop" }, "Ouvrir l'Atelier")))); return null; }
  const vp = createViewport(view, { select: false, name: () => id }), cap = el("span", { class: "chip stage", "data-fab-caption": "" }, "—");
  vp.setStatus(cap);
  const st = { plan: null, built: null, i: 0, states: new Map(), timer: 0, token: 0, busy: false };
  const spec = () => store.part(id), scene = (i) => { const b = st.states.get(i) || st.built; return sceneOf(st.plan.phases[i], spec().process, b.bbox); };
  const caption = (i) => { const ph = st.plan.phases[i], sc = scene(i); return `${ph.n} — ${ph.title} · ${sc.station.label}`; };
  async function stateOf(i) {
    if (st.states.has(i)) return st.states.get(i);
    const bendAt = st.plan.phases.findIndex((p) => p.key === "bend"), flat = bendAt > i ? flatOf(spec(), st.built) : null;      // a folded part is a flat blank until its bending phase
    const sp = flat ? flatSpec(flat, spec()) : stateSpec(spec(), st.plan, i), b = sp ? await kernel.build(sp, null, `${id}~fab${flat ? "flat" : i}`) : st.built;
    st.states.set(i, b); return b;
  }
  /** Paints step i : the part as it stands, placed for the tool, and the fixture of its station. → its measures */
  async function show(i, fit = true) {
    const token = st.token, b = await stateOf(i); if (token !== st.token) return null;
    st.i = i; const sc = sceneOf(st.plan.phases[i], spec().process, b.bbox), v = vp.viewer;
    for (const k of [...v.objects.keys()]) v.remove(k);
    showBuilt(v, b, { prefix: "fab-part", matrix: sc.place.matrix, pickable: false });
    for (const m of fixtureMeshes(sc.solids)) v.add(m);
    if (fit) v.fit(1.35); v.invalidate(); cap.textContent = caption(i);
    drawFlow(); drawRight(); return stepMeasures(b);
  }
  async function load() {
    const token = ++st.token; st.states.clear(); vp.setBusy("Gamme de la pièce, et la pièce telle qu'elle est après chaque phase…");
    try { st.built = await kernel.build(spec(), undefined, id); if (token !== st.token) return; st.plan = processPlan(spec(), st.built); vp.setBusy(""); await show(Math.min(st.i, st.plan.phases.length - 1)); setStatus(`Atelier : ${id}, ${st.plan.phases.length} phases`, "done"); }
    catch (e) { vp.setBusy(""); setStatus(`${id} : ${e.message}`, "bad"); }
  }
  const saveOrder = (keys, label) => store.updatePart(id, (x) => { x.plan = { ...(x.plan || {}), order: keys }; }, `${id} : atelier — ${label}`);
  const play = () => { if (st.timer) { clearInterval(st.timer); st.timer = 0; drawLeft(); return; } st.timer = setInterval(() => { if (st.i >= st.plan.phases.length - 1) { clearInterval(st.timer); st.timer = 0; drawLeft(); return; } show(st.i + 1); }, 2400); if (st.i >= st.plan.phases.length - 1) show(0); drawLeft(); };
  const flowBox = el("div", { class: "fab-flow", role: "list", "aria-label": "Les étapes de la gamme, dans l'ordre" }), scroll = el("div", { class: "side-scroll" }), actions = el("div", { class: "side-actions" });
  left.append(actions, scroll);
  function drawLeft() {
    actions.replaceChildren(pickList({ label: "Pièce fabriquée", value: id, groups: partGroups(parts()), onPick: (pid) => go(`#/fab/${encodeURIComponent(pid)}`) }),
      el("div", { class: "form-actions" }, btn("", () => st.plan && show(Math.max(0, st.i - 1)), { small: true, icon: "chevron-right", cls: "flip", tip: "Étape précédente (←)" }),
        btn(st.timer ? "Pause" : "Jouer la gamme", play, { small: true, primary: true, icon: "play", tip: "Les étapes l'une après l'autre, de la réception du brut à l'emballage" }), btn("", () => st.plan && show(Math.min(st.plan.phases.length - 1, st.i + 1)), { small: true, icon: "chevron-right", tip: "Étape suivante (→)" })));
    drawFlow();
  }
  function drawFlow() {
    if (!st.plan) return; const keys = flowKeys(st.plan), custom = !!(spec().plan && spec().plan.order); let drag = null;
    flowBox.replaceChildren(...st.plan.phases.map((ph, i) => { const sc = sceneOf(ph, spec().process, (st.states.get(i) || st.built).bbox);
      const row = el("div", { class: `fab-step${i === st.i ? " on" : ""}`, role: "listitem", draggable: "true", "data-step": ph.key, "aria-current": i === st.i ? "step" : null,
        onClick: () => show(i), onDragstart: (e) => { drag = ph.key; e.dataTransfer.effectAllowed = "move"; }, onDragover: (e) => e.preventDefault(), onDrop: (e) => { e.preventDefault(); if (drag && drag !== ph.key) saveOrder(dropKey(keys, drag, ph.key), `« ${ph.title} » déplacée`); } },
        el("span", { class: "fab-n" }, String(ph.n)), icon(ICON[sc.kind] || "gamme"), el("span", { class: "grow" }, el("b", null, ph.title), el("small", null, sc.station.label)),
        ...[[-1, "Monter", "chevron-right flip-up"], [1, "Descendre", "chevron-down"]].map(([d, t]) => { const nk = moveKey(keys, ph.key, d); return el("button", { class: "icon-btn", type: "button", disabled: !nk, "aria-label": `${t} « ${ph.title} »`, "data-tip": `${t} dans la gamme`, onClick: (e) => { e.stopPropagation(); if (nk) saveOrder(nk, `« ${ph.title} » ${d < 0 ? "avancée" : "reculée"}`); } }, icon(d < 0 ? "chevron-right" : "chevron-down")); }));
      return row; }));
    scroll.replaceChildren(el("div", { class: "side-section", "data-fold-note": `${st.plan.phases.length} étapes` }, el("h3", null, "La gamme, étape par étape"),
      el("p", { class: "muted small" }, "Glissez une étape pour en changer l'ordre (ou ses flèches) : l'ordre est gardé avec la pièce, et le guide dit ce qu'il dérange."), flowBox,
      custom ? btn("Revenir à l'ordre de l'outil", () => store.updatePart(id, (x) => { if (x.plan) delete x.plan.order; }, `${id} : atelier — ordre de l'outil`), { small: true, icon: "undo" }) : null),
      el("div", { class: "side-section" }, el("h3", null, "Partager avec le fournisseur"),
        el("div", { class: "form-actions" }, btn("Diaporama (.pptx)", (e, b) => out(b, () => fabDeck({ plan: st.plan, spec: spec(), viewer: vp.viewer, show: (i) => show(i), scene }), "diaporama"), { small: true, primary: true, icon: "download", tip: "Une diapositive par étape : l'image, les opérations, les mesures, et une case où le fournisseur écrit sa réponse" }),
          btn("Film (.webm)", (e, b) => out(b, () => recordFilm({ viewer: vp.viewer, steps: st.plan.phases.length, show: (i) => show(i), caption, name: id }), "film"), { small: true, icon: "camera", tip: "Les étapes filmées l'une après l'autre, leur titre incrusté dans l'image" })),
        planBar(st.plan, { aiKey: `part:${id}`, figures: async () => { const shots = []; for (let i = 0; i < st.plan.phases.length; i++) { await show(i); shots.push(shot(vp.viewer, caption(i), st.plan.phases[i].key)); } return shots; } })));
    setGuide([...orderIssues(st.plan, id).map((x) => ({ ...x, go: () => { const n = flowBox.querySelector(`[data-step="${x.field}"]`); if (n) n.scrollIntoView({ block: "center" }); } })),
      ...(st.plan.phases.length < 3 ? [{ level: "tip", text: `${id} — atelier : la pièce prend forme d'un coup (${spec().process || "procédé à choisir"}) : les étapes qui suivent montrent la pièce finie.` }] : [])]);
  }
  async function out(b, fn, what) { if (st.busy) return; st.busy = true; b.disabled = true; clearInterval(st.timer); st.timer = 0; const back = st.i;
    try { await fn(); } catch (e) { console.error(e); toast(`Atelier, ${what} : ${e.message}`, "error", 7000); } finally { st.busy = false; b.disabled = false; await show(back); } }
  function drawRight() {
    if (!st.plan) return; const ph = st.plan.phases[st.i], b = st.states.get(st.i) || st.built, prev = st.i ? st.states.get(st.i - 1) : null, sc = scene(st.i), m = stepMeasures(b), pm = prev ? stepMeasures(prev) : null, cm = ((spec().plan || {}).comments || {})[ph.key] || "";
    const area = (key, value, label, placeholder, write) => { const t = el("textarea", { rows: 3, "data-fab": key, "aria-label": label, placeholder, onChange: (e) => write(e.target.value) }); t.value = value; return t; };
    right.replaceChildren(el("div", { class: "side-head" }, el("h2", null, `${ph.n} — ${ph.title}`)), el("div", { class: "side-scroll" },
      el("div", { class: "side-section" }, el("h3", null, "Le poste"), el("p", null, icon(ICON[sc.kind] || "gamme"), " ", el("b", null, sc.station.label), " — ", sc.station.fr),
        el("p", { class: "muted small" }, "Montage de PRINCIPE, dessiné par l'outil : il dit l'intention ; l'atelier choisit son montage, ses outils et ses machines."), ph.hold ? el("p", null, el("b", null, "Prise de pièce : "), ph.hold) : null, ph.outsourced ? badge("sous-traité", "warn") : null),
      el("div", { class: "side-section" }, el("h3", null, `Opérations (${ph.ops.length})`), ph.ops.length ? el("ol", { class: "plan-ops" }, ph.ops.map((op) => el("li", null, el("b", null, op.n), ` ${op.text}`, op.tools.length ? el("small", null, ` — ${op.tools.join(", ")}`) : null))) : el("p", { class: "muted small" }, "Aucune opération : une phase de contrôle ou d'expédition."),
        ph.checks.length ? el("ul", { class: "plan-checks" }, ph.checks.map((c) => el("li", null, c))) : null),
      el("div", { class: "side-section", "data-fab-measures": "" }, el("h3", null, "Ce que la pièce mesure après cette phase"), ...measureWords(m).map((t) => el("p", null, t)),
        pm && m && (pm.size.join() !== m.size.join() || pm.mass !== m.mass) ? el("p", { class: "muted small" }, `Avant : ${fmtDims(pm.size, 1)}${pm.mass ? `, ${fmtMass(pm.mass)}` : ""} — la phase a changé la pièce.`) : null),
      el("div", { class: "side-section" }, el("h3", null, "Note de l'atelier"), area("note", ph.note || "", "Note de l'atelier pour cette phase", "Ce que l'atelier propose, ce qui est convenu…", (v) => store.updatePart(id, (x) => setPlanNote(x, ph.key, v), `${id} : note de la phase ${ph.n}`))),
      el("div", { class: "side-section" }, el("h3", null, "Réponse du fournisseur"), area("comment", cm, "Réponse du fournisseur pour cette phase", "Le fournisseur écrit ici, ou dans la case de sa diapositive…", (v) => store.updatePart(id, (x) => { const p = (x.plan = x.plan || {}); p.comments = { ...(p.comments || {}) }; if (v.trim()) p.comments[ph.key] = v.trim(); else delete p.comments[ph.key]; if (!Object.keys(p.comments).length) delete p.comments; }, `${id} : réponse du fournisseur, phase ${ph.n}`)))));
  }
  const key = (e) => { if (e.target.closest && e.target.closest("input, textarea, select") || !st.plan) return; if (e.key === "ArrowRight") show(Math.min(st.plan.phases.length - 1, st.i + 1)); else if (e.key === "ArrowLeft") show(Math.max(0, st.i - 1)); };
  document.addEventListener("keydown", key);
  const off = store.on("change", () => { if (!store.part(id)) { go("#/fab"); return; } load(); });
  drawLeft(); load();
  return () => { off(); st.token++; clearInterval(st.timer); document.removeEventListener("keydown", key); setGuide([]); };
}

registerModule({ key: "fab", label: "Atelier de fab", icon: "mill", tip: "La gamme d'une pièce jouée à l'atelier : chaque étape dans son montage, de la réception du brut à l'emballage — l'ordre se change ; diaporama et film pour le fournisseur", render });
