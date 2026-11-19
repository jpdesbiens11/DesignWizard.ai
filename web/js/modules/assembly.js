/* DesignWizard.ai — Assemblage: add parts and they mate themselves through their interfaces. A linked mate is a
   dependency: change one side, the other part adapts. Exploded view, BOM with the implied hardware, interference
   check, complementary-part generator, STEP of the assembly, and the assembly routing step by step (asm_gamme.js). */

import { el, clear, icon, btn, badge, toast, modal, fmt, fmtMass, fmtDims, inUnits, unitInput, download, promptBox, confirmBox, table, onOff } from "../core/dom.js";
import { registerModule, go, setStatus, app } from "../core/app.js";
import { store } from "../core/store.js";
import { instSwatch, asmLookTools, instLookSection, openInstLookPicker } from "./part_look.js";
import { kernel } from "../cad/client.js";
import { underVeil } from "../core/busy.js";
import { createViewport } from "../core/viewport.js";
import { mountPins } from "./view_pins.js";
import { buildAssembly, showAssembly, stepItems, stepCount } from "../core/asm_scene.js";
import { formSub, dissolveSub } from "../core/asm_form.js";
import { mountTurn } from "./asm_turn.js";
import { autoMate, candidates, freeInterfaces, ifaceOf, pairKey, joints, jointsCsv, nextJoint, placedTree } from "../core/assembly_logic.js";
import { assemblyHealth, HEALTH } from "../core/joint_health.js";
import { announceLinks } from "../core/part_edit.js";
import { companionSpec } from "../core/companion.js";
import { runDfa } from "../analysis/dfx_api.js";
import { matPoint, matDir, bboxTransform } from "../cad/vec.js";
import { INTERFACE_TYPES } from "../cad/interfaces.js";
import { gammeTab, showWhole } from "./asm_gamme.js";
import { mateTree, mateFind, mateLabels } from "../core/asm_tree.js";
import { liveAsm, offOf, setInstOff, instanceMenu, showAlone, showEvery } from "../core/asm_live.js";
import { popupMenu } from "../core/view_select.js";
import { mateSection } from "./asm_tree.js";
import { asmVariantsSection } from "./part_variants.js";
import { asmOut, variantTag } from "../core/variant_out.js";
import { topOf, isSub, ownsKey, usedIn } from "../core/asm_levels.js";
import { subTab, subChoices, levelRows, levelTable, levelCsv, formDialog } from "./asm_sub.js";
import { mateDefinition } from "../core/mate_view.js";
import { showMate, clearMate, mateDetail } from "./asm_mate.js";
import { nudge } from "../core/guide.js";

function render(main, args) {
  const list = store.assemblies;
  let id = args[0] && store.assembly(args[0]) ? args[0] : (list[0] && list[0].id) || null;
  const left = el("aside", { class: "side" }), right = el("aside", { class: "side right" }), view = el("div");
  const root = el("div", { class: "studio" }, left, view, right);
  main.append(root);
  if (!id) {
    root.classList.add("no-right"); right.remove();
    left.append(el("img", { class: "side-mark", src: "img/marks/assembly.svg", alt: "" }), el("div", { class: "side-head" }, el("h2", null, "Assemblages")));
    view.append(el("div", { class: "page" }, el("div", { class: "empty" }, el("h2", null, "Aucun assemblage"), el("p", null, "Créez un assemblage puis ajoutez-y des pièces : leurs interfaces identiques se matent toutes seules."),
      btn("Créer un assemblage", async () => { const name = await promptBox("Nouvel assemblage", "Nom", "Assemblage général"); if (name) go(`#/assembly/${encodeURIComponent(store.addAssembly(name))}`); }, { primary: true, icon: "plus" }))));
    return null;
  }
  const st = { ctx: null, sel: null, tab: "mates", token: 0, frames: false, dfa: null, interference: null, mate: null, showMates: {} };      // mate : the mate selected in the tree ; showMates : the labels of a state, on or off
  const asm = () => store.assembly(id);
  /* what an instance of this assembly is — a part, or a sub-assembly carried as one block (core/asm_levels.js) : its name, its icon, where it opens */
  const what = (inst) => { const sub = isSub(inst) ? store.assembly(inst.asm) : null, spec = isSub(inst) ? null : store.part(inst.part), fam = spec && (spec.family === "pcb" || spec.family === "extrusion") ? spec.family : null;
    return { sub, spec, name: sub ? sub.name || sub.id : spec ? spec.name || spec.id : inst.asm || inst.part, icon: isSub(inst) ? "assembly" : fam || "part", href: sub ? `#/assembly/${encodeURIComponent(sub.id)}` : spec ? `#/${fam || "parts"}/${encodeURIComponent(spec.id)}` : null }; };
  const keysOf = (iid) => [...vp.viewer.objects.keys()].filter((k) => ownsKey(iid, k));      // a part, or every part of a sub-assembly
  const without = (x, iid) => { x.instances = x.instances.filter((q) => q.id !== iid); x.mates = (x.mates || []).filter((k) => topOf(k.a.inst) !== iid && topOf(k.b.inst) !== iid); };      // an instance leaves with the joints that go through it
  const vp = createViewport(view, { name: () => id, explode: true, explodeScale: () => (st.ctx ? Math.max(20, (st.ctx.bbox[5] - st.ctx.bbox[2] + st.ctx.bbox[3] - st.ctx.bbox[0]) * 0.25) : 50),
    menuFor: (hit) => [...instMenu(hit && hit.def.data.inst ? topOf(hit.def.data.inst) : null), ...(hit && hit.def.data.inst ? ["—", ...pins.menu(hit)] : [])], onKey: (e) => instKey(e), keys: [["H · I · Maj + H", "Masquer la pièce choisie · l'isoler · tout afficher"], ["Entrée · Suppr", "Ouvrir la pièce choisie · la retirer de l'assemblage"]],
    onPick: (hit) => { st.sel = hit && hit.def.data.inst ? topOf(hit.def.data.inst) : null; vp.viewer.highlight(st.sel ? keysOf(st.sel) : []); renderLeft(); if (st.sel) { st.tab = "inst"; } renderRight(); } });
  const pins = mountPins(vp, { key: () => `assembly:${id}` });      // the messages pinned on this assembly, each on its instance
  /* the part chosen can be turned by hand : a ring and a grip round it in the view, the same angle as a number in its card */
  const turner = mountTurn(vp, { id, ctx: () => st.ctx, selected: () => (st.tab === "inst" && !st.mate ? st.sel : null), name: (iid) => { const i = asm().instances.find((q) => q.id === iid); return i ? what(i).name : iid; } });
  const info = el("span", { class: "chip" }, "—"), clash = el("span", { class: "chip", "data-tip": "Volumes communs entre pièces voisines, cherchés après chaque montage" }, "interférences : …");
  const healthChip = el("span", { class: "chip", style: { cursor: "pointer" }, onClick: () => { st.tab = "mates"; renderRight(); } }, "accouplements : …");
  vp.setStatus(info, clash, healthChip);
  /* the health of the joints : recomputed after every solve and every interference search, shown under the view and in the register */
  const health = () => { const c = st.ctx; return c ? assemblyHealth(c.asm, c.built, Object.fromEntries(store.parts.map((x) => [x.id, x])), c.sol, (st.interference || []).map((r) => ({ a: r.ia, b: r.ib, volume: r.volume }))) : null; };
  const showHealth = () => { const h = health(); if (!h) return; healthChip.textContent = `accouplements : ${h.text}`; healthChip.className = `chip ${h.state === "ok" ? "done" : h.state === "broken" ? "bad" : "warn"}`; healthChip.dataset.tip = h.rows.filter((r) => r.notes.length).map((r) => `${r.id} — ${r.notes.join(" ")}`).join(" · ") || "Chaque joint dit la même chose des deux côtés, et les pièces ne se traversent pas"; };
  const bF = btn("", () => { st.frames = !st.frames; bF.classList.toggle("on", st.frames); overlays(); }, { small: true, icon: "interfaces", tip: "Afficher les interfaces et les mates" });
  vp.group(bF, btn("Interférences", () => checkInterference(), { small: true, icon: "warning", tip: "Chercher les volumes communs entre pièces" }));

  const off = store.on("change", (c) => { if (!asm()) { go("#/assembly"); return; } announceLinks(c); renderLeft(); rebuild(); });
  renderLeft(); renderRight(); rebuild(true);

  async function rebuild(first) {
    const token = ++st.token, a = asm();
    if (a.pendingAutoMate) { store.updateAssembly(id, (x) => { delete x.pendingAutoMate; }, `${id} : préparation`); return; }
    const stop = () => { st.token++; kernel.cancel(); setStatus("Construction annulée", ""); info.textContent = "construction annulée"; info.className = "chip"; vp.setBusy("Construction annulée : l'assemblage n'est pas affiché.", { stopped: true, retry: () => rebuild(true) }); };
    vp.setBusy(st.ctx ? "" : "Construction de l'assemblage…", { cancel: stop });
    try {
      const ctx = await buildAssembly(a, (t, done, total) => vp.setBusy(st.ctx ? "" : t, { done, total, cancel: stop }));
      if (token !== st.token) return;
      // a part was just added: mate what can be mated, then solve again (one more undo step)
      const cand = candidates(ctx.asm, ctx.built);
      if (cand.length && st.autoFor !== JSON.stringify(a.instances.map((i) => i.id))) {
        st.autoFor = JSON.stringify(a.instances.map((i) => i.id));
        let added = [];
        const master = ctx.asm.instances.find((i) => i.fixed) || ctx.asm.instances[0];
        store.commit(`${id} : mates automatiques`, (p) => { added = autoMate(p.assemblies.find((x) => x.id === id), ctx.built, ctx.asm); }, { assembly: id, part: master && master.part });
        if (added.length) { toast(`${added.length} mate(s) créé(s) automatiquement à partir des interfaces.`, "success", 5000); return; }
      }
      st.ctx = ctx;
      showAssembly(vp.viewer, ctx);
      if (!st.fitted) { st.fitted = true; vp.viewer.view("iso"); } else vp.viewer.invalidate();
      vp.setBusy("");
      const s = ctx.sol;
      const nSub = Object.keys(ctx.asm.groups || {}).length;
      info.textContent = `${ctx.asm.instances.length} pièce(s)${nSub ? ` dont ${ctx.asm.instances.filter((i) => i.group).length} dans ${nSub} sous-assemblage${nSub > 1 ? "s" : ""}` : ""}${offOf(a).instances.length ? ` (+ ${offOf(a).instances.length} à Off)` : ""} · ${(ctx.asm.mates || []).length} mate(s) · ${fmtMass(ctx.mass.mass)} · ${fmtDims([ctx.bbox[3] - ctx.bbox[0], ctx.bbox[4] - ctx.bbox[1], ctx.bbox[5] - ctx.bbox[2]], 0)}`
        + (s.floating.length ? ` · ${s.floating.length} pièce(s) non matée(s)` : "") + (ctx.errors.length ? ` · ${ctx.errors.length} erreur(s)` : "");
      info.className = "chip" + (ctx.errors.length || s.problems.length ? " bad" : "");
      setStatus(`${id} assemblé`, "done");
      st.dfa = await runDfa(ctx.asm, { parts: Object.fromEntries(Object.keys(ctx.built).map((k) => [k, { spec: store.part(k), built: ctx.built[k] }])), hardware: ctx.hardware, interference: st.interference, placements: s.placements });
      if (token !== st.token) return;
      overlays(); renderLeft(); renderRight(); showHealth();
      if (ctx.asm.instances.length > 1 && ctx.asm.instances.length <= 14) checkInterference(true); else { clash.textContent = ctx.asm.instances.length > 14 ? "interférences : à lancer" : ""; clash.className = "chip"; }      // every solve is checked, quietly
    } catch (e) { if (token === st.token) { vp.setBusy(""); info.textContent = e.message; info.className = "chip bad"; } }
  }
  function overlays() {
    const v = vp.viewer;
    v.clearOverlays("frame"); v.clearOverlays("mate");
    if (!st.ctx) return;
    const { asm: a, built, sol } = st.ctx;
    if (st.frames) for (const inst of a.instances) for (const it of built[inst.part].interfaces) {
      const m = sol.placements[inst.id], fr = { o: matPoint(m, it.frame.o), u: matDir(m, it.frame.u), v: matDir(m, it.frame.v), n: matDir(m, it.frame.n) };
      v.addFrame(fr, it.side === "A" ? "#9b7bff" : "#2ec4b6", "frame");
    }
    /* the labels of the mates : a state whose eye is open, in the colour of its health ; the selected one always ; all of them with the frames */
    const tree = mateTree(liveAsm(a), (health() || { rows: [] }).rows, (i) => instName(a, i)), labelled = st.frames ? tree.flatMap((g) => g.items.map((it) => ({ ...it, selected: it.id === st.mate }))) : mateLabels(tree, st.showMates, st.mate);
    for (const it of labelled) {
      const ia = a.instances.find((i) => i.id === it.a.inst), fa = ia && ifaceOf(built, ia.part, it.a.iface); if (!fa || !sol.placements[ia.id]) continue;
      const b = v.addLabel(matPoint(sol.placements[ia.id], fa.frame.o), `${it.id}${it.linked ? " 🔗" : ""}`, "mate", `bc${it.selected ? " sel" : ""}`, () => selectMate(it.selected ? null : it.id));
      b.style.borderColor = it.color; b.style.setProperty("--bc", it.color); b.dataset.tip = `${it.text}${it.notes.length ? ` — ${it.notes[0]}` : ""}`;
    }
    for (const x of st.interference || []) if (x.volume > 0 && x.at) { v.addMarker(x.at, "#ff5a4f", "mate", 1.6); v.addLabel(x.at, `Interférence ${fmt(x.volume, 0)} mm³`, "mate", "err"); }
    const md = st.mate ? defOf(st.mate) : null; if (md) showMate(v, md); else clearMate(v);       // the chosen mate : its hardware in place, its two parts see-through
    pins.draw();
  }
  /** What a mate is : its two sides, its plane, its hardware, its facts (core/mate_view.js). */
  function defOf(mid) { const c = st.ctx, m = c && (c.asm.mates || []).find((k) => k.id === mid); return m ? mateDefinition(c.asm, c.built, c.sol.placements, m, Object.fromEntries(c.asm.instances.map((i) => [i.id, instName(c.asm, i.id)]))) : null; }
  async function checkInterference(quiet = false) {
    if (!st.ctx) return;
    const { asm: a, built, sol } = st.ctx, pairs = [], names = [];
    const boxes = a.instances.map((i) => bboxTransform(built[i.part].bbox, sol.placements[i.id]));
    for (let i = 0; i < a.instances.length; i++) for (let j = i + 1; j < a.instances.length; j++) {
      const p = boxes[i], q = boxes[j];
      if (p[0] > q[3] || q[0] > p[3] || p[1] > q[4] || q[1] > p[4] || p[2] > q[5] || q[2] > p[5]) continue;
      pairs.push({ a: { key: a.instances[i].part, matrix: sol.placements[a.instances[i].id] }, b: { key: a.instances[j].part, matrix: sol.placements[a.instances[j].id] } });
      names.push([a.instances[i], a.instances[j]]);
    }
    const mine = st.token; if (!quiet) vp.setBusy(`Recherche d'interférences sur ${pairs.length} paire(s)…`, { cancel: () => { kernel.cancel(); vp.setBusy(""); clash.textContent = "interférences : recherche annulée"; clash.className = "chip"; rebuild(); } });      // the kernel starts afresh : the parts are built again, quietly
    try {
      const res = await kernel.interference(pairs); if (mine !== st.token) return;
      st.interference = res.map((r, k) => ({ ...r, a: names[k][0].part, b: names[k][1].part, ia: names[k][0].id, ib: names[k][1].id })).filter((r) => r.volume > 0.5);
      showHealth(); if (st.tab === "mates") renderRight();
      clash.textContent = st.interference.length ? `${st.interference.length} interférence(s)` : "aucune interférence"; clash.className = `chip ${st.interference.length ? "bad" : "done"}`; clash.dataset.tip = st.interference.length ? st.interference.map((r) => `${r.a} ∩ ${r.b} : ${fmt(r.volume, 1)} mm³`).join(" · ") : `${pairs.length} paire(s) de pièces voisines comparées`;
      if (!quiet || st.interference.length) toast(st.interference.length ? `${st.interference.length} interférence(s) trouvée(s) : ${st.interference.map((r) => `${r.a} ∩ ${r.b}`).slice(0, 3).join(", ")}.` : "Aucune interférence entre les pièces.", st.interference.length ? "warn" : "success");
      if (!quiet) st.tab = "dfa";
    } catch (e) { if (e && e.cancelled) return; if (!quiet) toast(e.message, "error"); }
    if (!quiet) vp.setBusy(""); overlays(); renderRight();
  }

  /* ---------- left ---------- */
  function renderLeft() {
    clear(left);
    const a = asm();
    left.append(el("img", { class: "side-mark", src: "img/marks/assembly.svg", alt: "" }),
      el("div", { class: "side-head" }, el("h2", null, "Assemblages"), btn("", async () => { const name = await promptBox("Nouvel assemblage", "Nom", "Sous-ensemble"); if (name) go(`#/assembly/${encodeURIComponent(store.addAssembly(name))}`); }, { small: true, icon: "plus", tip: "Nouvel assemblage" })));
    const scroll = el("div", { class: "side-scroll" });
    left.append(scroll);
    scroll.append(el("div", { class: "side-section" }, store.assemblies.map((x) => el("a", { class: "nav-item" + (x.id === id ? " active" : ""), href: `#/assembly/${encodeURIComponent(x.id)}` }, icon("assembly"), el("span", { class: "grow" }, x.name || x.id), el("small", null, x.id)))));
    const sec = el("div", { class: "side-section" }, el("h3", null, el("span", { class: "grow" }, `Pièces de l'assemblage (${a.instances.length - offOf(a).instances.length}${offOf(a).instances.length ? ` + ${offOf(a).instances.length} à Off` : ""})`), asmLookTools({ asm: a, id }), btn("", () => formFrom(st.sel ? [st.sel] : []), { small: true, icon: "assembly", tip: "Former un sous-assemblage : des pièces d'ici partent ensemble et reviennent d'un seul bloc" }), btn("", () => addDialog(), { small: true, icon: "plus", tip: "Ajouter une pièce du projet" })));
    for (const inst of a.instances) {
      const { spec, sub, name, icon: mark } = what(inst), placed = st.ctx && st.ctx.sol.placedBy[inst.id], nIn = sub && st.ctx ? st.ctx.asm.instances.filter((i) => i.group === inst.id).length : 0;
      sec.append(el("div", { class: "nav-item" + (st.sel === inst.id ? " active" : "") + (inst.hidden ? " off" : "") + (inst.off ? " is-off" : ""), role: "button", tabindex: "0", "data-inst": inst.id, "aria-haspopup": "menu",
        /* a right click on the line : the menu of the part — show it alone, bring the others back, on / off, fix, open, remove (the same menu as on the part in the view) */
        "data-kind": isSub(inst) ? "sub" : "part", "data-tip": `${isSub(inst) ? "Sous-assemblage : il se porte d'un seul bloc. " : ""}Clic : ${isSub(inst) ? "le" : "la"} sélectionner · clic droit : ses options (${isSub(inst) ? "le" : "la"} montrer seul${isSub(inst) ? "" : "e"}, tout afficher, On / Off, fixer, ouvrir, retirer)`,
        onContextmenu: (e) => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(), at = e.clientX || e.clientY ? { clientX: e.clientX, clientY: e.clientY } : { clientX: r.left + 24, clientY: r.bottom };      // the menu key has no pointer : under the line
          if (st.sel !== inst.id) { st.sel = inst.id; vp.viewer.highlight(keysOf(inst.id)); renderLeft(); if (st.tab === "inst") renderRight(); }
          popupMenu(at, instMenu(inst.id)); },
        onClick: () => { st.sel = inst.id; st.tab = "inst"; vp.viewer.highlight(keysOf(inst.id)); renderLeft(); renderRight(); } },
        icon(mark), el("span", { class: "grow" }, spec || sub ? name : `${name} (absent${isSub(inst) ? "" : "e"})`), nIn ? el("small", { "data-tip": `Sous-assemblage de ${nIn} pièce${nIn > 1 ? "s" : ""}` }, `${nIn} p.`) : null, spec || sub ? instSwatch(id, inst) : null,      // what it shows HERE : the look the assembly gives it, or that of its part
        inst.off ? el("span", { class: "off-chip" }, "Off") : inst.fixed ? badge("fixe", "neutral") : placed ? badge("matée", "ok") : badge("libre", "warn"),
        /* On / Off : put aside, the part stays in the list with its joints and counts for nothing — view, bill of materials, mass, drawing, exports */
        onOff(!inst.off, (on) => store.updateAssembly(id, (x) => { setInstOff(x, inst.id, !on); }, `${name} ${on ? "à On" : "à Off"}`), name,
          inst.off ? "À Off : hors de la vue, de la nomenclature, de la masse, des accouplements et des exports — cliquer pour la remettre (On)" : "À On — cliquer pour la mettre de côté (Off) sans la retirer : elle garde sa place et ses accouplements"),
        iconBtn(inst.hidden ? "eye-off" : "eye", inst.hidden ? "Afficher" : "Masquer", () => store.updateAssembly(id, (x) => { const i = x.instances.find((q) => q.id === inst.id); if (i.hidden) delete i.hidden; else i.hidden = true; }, `${name} ${inst.hidden ? "à l'écran" : "hors de l'écran"}`))));
    }
    if (!a.instances.length) sec.append(el("p", { class: "muted" }, "Ajoutez une première pièce : elle sera la pièce fixe."));
    scroll.append(sec, asmVariantsSection({ asm: a, id, names: Object.fromEntries(a.instances.map((i) => { const s = store.part(i.part); return [i.id, s ? s.name || s.id : i.part]; })) }));      // the parts on and off, kept under a name
    if (st.ctx) scroll.append(el("div", { class: "side-section" }, el("h3", null, `Accouplements (${(liveAsm(a).mates || []).length}${offOf(a).mates.length ? ` + ${offOf(a).mates.length} en attente` : ""})`),
      mateSection({ tree: mateTree(liveAsm(a), (health() || { rows: [] }).rows, (i) => instName(a, i)), sel: st.mate, show: st.showMates, select: selectMate,
        hover: (it) => { if (!st.mate) vp.viewer.highlight(it ? [...keysOf(it.a.inst), ...keysOf(it.b.inst)] : []); },
        relabel: (k, on) => { st.showMates[k] = on; renderLeft(); overlays(); } }),
      el("p", { class: "muted small" }, "Un clic sur un accouplement allume ses deux pièces et ouvre sa fiche à droite ; l'œil d'un état affiche ou masque ses étiquettes sur le modèle.")));
    scroll.append(el("div", { class: "side-section" }, el("h3", null, "Assemblage"),
      btn("STEP", () => exportStep(), { small: true, icon: "step", tip: "Télécharger le STEP AP214 de l'assemblage (pièces nommées, positions résolues)" }), " ",
      btn("Envoyer vers Onshape", () => go(`#/onshape/${encodeURIComponent(id)}`), { small: true, icon: "onshape" }), " ",
      btn("Supprimer", async () => { const held = usedIn(store.assemblies, id); if (await confirmBox("Supprimer l'assemblage", `Supprimer ${id} ? Les pièces restent dans le projet.${held.length ? ` Il est sous-assemblage de ${held.map((h) => h.id).join(", ")} : il en sort aussi, avec ses accouplements. (Ctrl + Z pour revenir.)` : ""}`, "Supprimer", true)) { store.removeAssembly(id); go("#/assembly"); } }, { small: true, icon: "trash", danger: true }),
      /* where this assembly is used : it is a sub-assembly of those */
      usedIn(store.assemblies, id).length ? el("p", { class: "muted small", style: { margin: ".5rem 0 0" } }, "Sous-assemblage de : ", usedIn(store.assemblies, id).flatMap((h, k) => [k ? ", " : "", el("a", { href: `#/assembly/${encodeURIComponent(h.id)}` }, `${h.name || h.id}${h.qty > 1 ? ` (× ${h.qty})` : ""}`)])) : null));
  }
  /** Selects a mate (null : none) : its two parts light up, its label shows, its card opens on the right. */
  function selectMate(mid) {
    st.mate = mid; const it = mid && st.ctx ? mateFind(mateTree(st.ctx.asm, (health() || { rows: [] }).rows), mid) : null;
    vp.viewer.highlight(it ? [...keysOf(it.a.inst), ...keysOf(it.b.inst)] : []);
    if (it) { st.sel = null; st.tab = "mates"; } renderLeft(); renderRight(); overlays();
    if (it) setTimeout(() => nudge(right.querySelector(`[data-mate="${mid}"]`)), 80);
  }
  function iconBtn(name, tip, fn) {
    const b = el("button", { class: "icon-btn", type: "button", "data-tip": tip, "aria-label": tip, onClick: (e) => { e.stopPropagation(); fn(); } }, icon(name));
    b.style.fontSize = "1rem"; b.style.padding = "0 .15rem";
    return b;
  }
  function addDialog() {
    const subs = subChoices(asm(), (sid) => { m.close(); addInstance(sid, true); });
    const m = modal("Ajouter à l'assemblage", [el("p", { class: "muted" }, "Une pièce — ou un sous-assemblage, porté d'un seul bloc — se place d'elle-même si l'une de ses interfaces correspond à une interface libre de l'assemblage (même type, même clé ou même géométrie, côtés A et B)."),
      el("h3", { class: "pick-head", style: { "--pick": "#0c66e4" } }, icon("part"), ` Pièces (${store.parts.length})`),
      el("div", { class: "grid" }, store.parts.map((p) => el("button", { class: "card lift", type: "button", onClick: () => { m.close(); addInstance(p.id); } }, el("h3", null, icon(p.family === "pcb" ? "pcb" : "part"), " ", p.name || p.id),
        el("p", { class: "muted", style: { margin: 0, fontSize: ".82rem" } }, `${p.id} · ${(p.interfaces || []).length} interface(s)`)))),
      !store.parts.length && el("p", null, "Le projet n'a pas encore de pièce."),
      el("h3", { class: "pick-head", style: { "--pick": "#7a5af8" } }, icon("assembly"), ` Sous-assemblages (${subs.length})`),
      subs.length ? el("div", { class: "grid" }, subs) : el("p", { class: "muted" }, "Aucun autre assemblage dans le projet. Un sous-assemblage est un assemblage comme les autres : créez-le avec le « + » de la liste des assemblages, puis ajoutez-le ici.")], { wide: true });
  }
  function addInstance(what, sub = false) {
    store.updateAssembly(id, (a) => {
      let n = a.instances.length + 1, iid; do { iid = `${sub ? "s" : "i"}${n++}`; } while (a.instances.some((i) => i.id === iid));
      a.instances.push({ id: iid, [sub ? "asm" : "part"]: what, fixed: a.instances.length === 0 || undefined, placement: { t: [0, 0, 0], r: [0, 0, 0] } });
    }, `${what} ajouté${sub ? "" : "e"} à ${id}`);
  }
  /* levels : parts of this assembly become a sub-assembly of their own, a sub-assembly gives back what it holds — one undoable step each, nothing moves (core/asm_form.js) */
  function formFrom(pre = []) {
    if (!st.ctx) return;
    formDialog({ asm: asm(), pre, nameOf: (i) => what(i).name, done: (chosen, name) => { const nid = store.uniqueId(`ASM-${String(store.assemblies.length + 1).padStart(3, "0")}`); let r = null;
      try { store.commit(`Sous-assemblage formé : ${name}`, (p) => { r = formSub(p, id, chosen, { id: nid, name, placements: st.ctx.sol.placements }); }, { assembly: id }); } catch (e) { toast(e.message, "error"); return; }
      st.sel = r.inst; st.tab = "inst"; toast(`${name} (${nid}) : ${r.ids.length} élément(s) en un bloc, ${r.inner.length} accouplement(s) à l'intérieur, ${r.across.length} vers cet assemblage. Ctrl + Z pour revenir.`, "success", 7000); } });
  }
  function dissolve(iid) {
    if (!st.ctx) return; const node = placedTree(asm(), st.ctx.built, (x) => store.assembly(x)).find((n) => n.inst === iid); let r = null;
    try { store.commit(`Sous-assemblage dissous dans ${id}`, (p) => { r = dissolveSub(p, id, iid, { tree: node }); }, { assembly: id }); } catch (e) { toast(e.message, "error"); return; }
    st.sel = null; toast(`${r.asm} dissous : ${r.added.length} élément(s) et ${r.mates} accouplement(s) remontent ici, à la même place. Il reste dans le projet. Ctrl + Z pour revenir.`, "success", 7000);
  }
  const tagNow = () => variantTag(asmOut(asm()).variant);
  async function exportStep() {
    if (!st.ctx) return;
    try {
      const items = stepItems(asm(), st.ctx.built), subs = items.filter((it) => it.children).length;      // the levels are kept : a sub-assembly is a product of its own in the file
      const bytes = await underVeil({ set: (t, o) => vp.setBusy(t, o) }, `Écriture du STEP de l'assemblage — ${stepCount(items)} pièce(s)${subs ? `, ${subs} sous-assemblage(s)` : ""}…`, () => kernel.step(items, `${id} ${asm().name || ""}${asmOut(asm()).variant ? ` — ${asmOut(asm()).variant}` : ""}`.trim()),
        { after: () => rebuild(), cancelled: "Export annulé : aucun fichier n'a été écrit." });      // once stopped the kernel starts afresh : the parts are built again, quietly
      if (bytes !== undefined) download(`${id}${tagNow()}.step`, bytes, "application/step");      // the file says which variant of the assembly it is
    } catch (e) { toast(e.message, "error"); }
  }

  /* ---------- right ---------- */
  function renderRight() {
    clear(right); turner.draw();      // the handle follows the part chosen, and what the card shows
    const a = asm(), tabs = [["mates", "Mates"], ["inst", "Pièce"], ["bom", "BOM"], ["dfa", "DFA"], ["gamme", "Gamme"]];
    if (st.tab !== "gamme" && st.step) { st.step = null; showWhole(vp); }      // leaving the routing sheet : the whole product again
    const nErr = st.dfa && st.dfa.summary ? st.dfa.summary.errors : 0;
    right.append(el("div", { class: "side-head" }, el("h2", null, a.name || id)), el("div", { class: "subtabs", style: { margin: "0 .6rem" } }, tabs.map(([k, l]) => el("button", { class: "subtab" + (st.tab === k ? " active" : ""), type: "button", onClick: () => { st.tab = k; renderRight(); } }, l, k === "dfa" && nErr ? ` (${nErr})` : ""))));
    const body = el("div", { class: "side-scroll" });
    right.append(body);
    if (!st.ctx) { body.append(el("p", { class: "muted" }, "Construction…")); return; }
    ({ mates: matesTab, inst: instTab, bom: bomTab, dfa: dfaTab, gamme: (b, x) => gammeTab(b, x, { st, vp, id }) })[st.tab](body, a);
  }
  const instName = (a, iid) => { const mine = asm().instances.find((x) => x.id === topOf(iid)); if (!mine) return iid; if (iid === mine.id) return what(mine).name;      // « Carte (Module) » : a part inside a sub-assembly says which one
    const leaf = st.ctx && st.ctx.asm.instances.find((x) => x.id === iid), s = leaf && store.part(leaf.part); return `${s ? s.name || s.id : iid} (${what(mine).name})`; };
  function matesTab(body, a) {
    const { built, sol } = st.ctx, cand = candidates(st.ctx.asm, built, true);
    body.append(el("p", { class: "muted", style: { fontSize: ".84rem" } }, "Un mate relie deux interfaces identiques (côté A et côté B). S'il est lié 🔗, les deux pièces partagent les paramètres de l'interface : modifiez un côté, l'autre s'adapte."));
    if (cand.length) {
      body.append(el("div", { class: "side-section" }, el("h3", null, el("span", { class: "grow" }, `Mates possibles (${cand.length})`), btn("Tout mater", () => { store.commit(`${id} : mates automatiques`, (p) => autoMate(p.assemblies.find((x) => x.id === id), built, st.ctx.asm), { assembly: id, part: (st.ctx.asm.instances.find((i) => i.fixed) || st.ctx.asm.instances[0] || {}).part }); }, { small: true, icon: "sparkle" })),
        cand.slice(0, 12).map((c) => el("div", { class: "finding", onClick: () => store.updateAssembly(id, (x) => { x.mates = x.mates || []; const n = nextJoint(x); x.mates.push({ id: `M${n}`, a: c.a, b: c.b, linked: true, by: c.by, ...(c.flip ? { flip: true } : {}) }); x.mseq = n;
          x.rejected = (x.rejected || []).filter((k) => k !== pairKey(c.a, c.b)); }, `Mate ajouté : ${c.label}`) },
          el("span", { class: "sev" }), el("div", null, el("b", null, `${instName(a, c.a.inst)} ↔ ${instName(a, c.b.inst)}`)), el("p", null, `${c.label} · ${c.by === "key" ? "même clé" : "même géométrie"}${c.same ? "" : " · paramètres différents : le côté B s'adaptera"}${c.rejected ? " · retiré à la main : cliquez pour le remettre" : ""}`)))));
    }
    /* the joint register : each mated pair keeps its number, says what kind of joint it is and what holds it */
    const reg = joints(st.ctx.asm, built, Object.fromEntries(store.parts.map((x) => [x.id, x]))), byId = new Map(reg.map((r) => [r.id, r])), H = health(), hOf = new Map(H.rows.map((r) => [r.id, r]));
    for (const r of reg) { const h = hOf.get(r.id); if (h) { r.health = HEALTH[h.state].fr; r.notes = h.notes; } }
    body.append(el("p", { class: `atelier-hint${H.state === "ok" ? "" : " warn"}`, style: { fontSize: ".84rem" } }, icon(H.state === "ok" ? "check" : "warning"), ` Santé des accouplements — ${H.text}.`));
    body.append(el("div", { class: "side-section" }, el("h3", null, el("span", { class: "grow" }, `Joints (${(liveAsm(a).mates || []).length})`), reg.length ? btn("Registre (.csv)", () => download(`${id}${tagNow()}-joints.csv`, jointsCsv(reg), "text/csv"), { small: true, icon: "download", tip: "Le registre des joints : numéro, genre, pièces, clé, visserie ou colle, procédé" }) : null)));
    if (offOf(a).mates.length) body.append(el("p", { class: "muted small" }, `${offOf(a).mates.length} accouplement${offOf(a).mates.length > 1 ? "s" : ""} en attente (${offOf(a).mates.join(", ")}) : une de leurs pièces est à Off. Ils reviennent avec elle.`));
    for (const m of liveAsm(a).mates || []) {
      const ia = st.ctx.asm.instances.find((i) => i.id === m.a.inst), fa = ia && ifaceOf(built, ia.part, m.a.iface), pb = sol.problems.find((p) => p.mate === m.id);
      body.append(el("div", { class: "card", "data-mate": m.id, "data-tip": st.mate === m.id ? null : "Cliquer : voir ce joint — ses deux interfaces, sa visserie, sa coupe", style: { marginBottom: ".5rem", padding: ".5rem .65rem", cursor: "pointer", ...(st.mate === m.id ? { outline: "2px solid var(--acc)" } : {}) }, onClick: (e) => { if (e.target.closest("button, a, input, select")) return; selectMate(st.mate === m.id ? null : m.id); } },
        el("div", { style: { display: "flex", gap: ".35rem", alignItems: "center", flexWrap: "wrap" } }, el("b", null, m.id), badge(byId.get(m.id) ? byId.get(m.id).kind : fa ? INTERFACE_TYPES[fa.type].label : "?", byId.get(m.id) && byId.get(m.id).type === "bond" ? "info" : "neutral"), m.linked === false ? badge("non lié", "warn") : badge("lié 🔗", "ok"), hOf.get(m.id) ? badge(HEALTH[hOf.get(m.id).state].fr, HEALTH[hOf.get(m.id).state].tone) : null),
        el("p", { style: { margin: ".25rem 0", fontSize: ".84rem" } }, `${instName(a, m.a.inst)} (${m.a.iface}) ↔ ${instName(a, m.b.inst)} (${m.b.iface})`), ...(hOf.get(m.id) ? hOf.get(m.id).notes : pb ? [pb.msg] : []).map((t) => el("p", { class: "form-error", style: { fontSize: ".8rem" } }, t)),
        byId.get(m.id) && (byId.get(m.id).hardware.length || byId.get(m.id).process) ? el("p", { class: "muted", style: { margin: ".15rem 0", fontSize: ".8rem" } }, [byId.get(m.id).hardware.map((h) => `${String(h.qty).replace(".", ",")}${h.unit ? ` ${h.unit}` : " ×"} ${h.name}`).join(" + "), byId.get(m.id).process].filter(Boolean).join(" — ")) : null,
        st.mate === m.id ? mateDetail(defOf(m.id)) : null,
        el("div", { class: "form-actions", style: { justifyContent: "flex-start", marginTop: ".2rem" } },
          btn(m.linked === false ? "Lier" : "Délier", () => store.updateAssembly(id, (x) => { const q = x.mates.find((k) => k.id === m.id); q.linked = q.linked === false; }, `${m.id} ${m.linked === false ? "lié" : "délié"}`), { small: true, icon: m.linked === false ? "link" : "unlink", tip: "Lié : les paramètres de l'interface sont partagés" }),
          btn("90°", () => store.updateAssembly(id, (x) => { const q = x.mates.find((k) => k.id === m.id); q.angle = ((q.angle || 0) + 90) % 360; }, `${m.id} tourné de 90°`), { small: true, icon: "refresh", tip: "Tourner la pièce B de 90° autour de la normale de l'interface" }),
          btn("", () => store.updateAssembly(id, (x) => { x.mates = x.mates.filter((k) => k.id !== m.id); x.rejected = [...new Set([...(x.rejected || []), pairKey(m.a, m.b)])]; }, `${m.id} supprimé`), { small: true, icon: "trash", danger: true, tip: "Supprimer ce mate (il ne sera pas recréé automatiquement)" }))));
    }
    const open = freeInterfaces(st.ctx.asm, built), free = open.filter((f) => !f.external), outer = open.filter((f) => f.external);
    if (outer.length) body.append(el("div", { class: "side-section" }, el("h3", null, `Interfaces externes (${outer.length})`), el("p", { class: "muted small" }, "Le contrat du produit avec ce qui l'entoure : elles n'attendent aucune pièce du projet."),
      outer.map((f) => el("p", { style: { fontSize: ".84rem", margin: "0 0 .25rem" } }, badge("externe", "info"), " ", el("b", null, f.iface.name || f.iface.id), el("span", { class: "muted" }, ` — ${f.part} · ${INTERFACE_TYPES[f.iface.type].label}${f.iface.partner ? ` → ${f.iface.partner}` : ""}`)))));
    if (free.length) body.append(el("div", { class: "side-section" }, el("h3", null, `Interfaces libres (${free.length})`),
      free.map((f) => el("div", { class: "finding", onClick: () => makeCompanion(f) }, el("span", { class: "sev" }), el("div", null, el("b", null, f.iface.name), el("span", { class: "id" }, `${f.part} · ${f.iface.id} · côté ${f.iface.side}`)),
        el("p", null, `Aucun voisin ne porte encore le côté ${f.iface.side === "A" ? "B" : "A"}. Cliquez pour générer la pièce complémentaire, ou décrivez-la par l'entrevue.`)))));
  }
  function makeCompanion(f) {
    try {
      const spec = companionSpec(store.part(f.part), st.ctx.built[f.part], f.iface.id, store.nextPartId());
      store.commit(`Pièce complémentaire de ${f.part} / ${f.iface.id}`, (p) => {
        p.parts.push(spec);
        const a = p.assemblies.find((x) => x.id === id); let n = a.instances.length + 1, iid; do { iid = `i${n++}`; } while (a.instances.some((i) => i.id === iid));
        a.instances.push({ id: iid, part: spec.id, placement: { t: [0, 0, 0], r: [0, 0, 0] } });
      }, { assembly: id });
      toast(`Pièce ${spec.id} générée et ajoutée : elle se mate sur « ${f.iface.name} ».`, "success", 5000);
    } catch (e) { toast(e.message, "error"); }
  }
  /* ---- what a right click offers on a part of the assembly, and the same by keys ---- */
  const hiddenOnes = () => asm().instances.filter((i) => i.hidden);
  const showAll = () => store.updateAssembly(id, (x) => { showEvery(x); }, `${id} : toutes les pièces affichées`);
  const hide = (iid) => store.updateAssembly(id, (x) => { x.instances.find((q) => q.id === iid).hidden = true; }, `${iid} masquée`);
  const isolate = (iid) => store.updateAssembly(id, (x) => { showAlone(x, iid); }, `${iid} montrée seule`);
  const openPart = (iid) => { const inst = asm().instances.find((i) => i.id === iid), href = inst && what(inst).href; if (href) go(href); };
  const dropInst = async (iid) => { const inst = asm().instances.find((i) => i.id === iid), name = inst && what(inst).name; if (!inst || !(await confirmBox(isSub(inst) ? "Retirer le sous-assemblage" : "Retirer la pièce", `Retirer ${name} de ${id} ? Ses liaisons partent avec ${isSub(inst) ? "lui. Le sous-assemblage reste dans le projet" : "elle"}. (Ctrl + Z pour revenir.)`, "Retirer", true))) return;
    store.updateAssembly(id, (x) => without(x, iid), `${name} retiré${isSub(inst) ? "" : "e"} de ${id}`); st.sel = null; };
  function instMenu(iid) {
    const inst = iid ? asm().instances.find((i) => i.id === iid) : null, hid = hiddenOnes(), back = hid.length ? [{ label: `Tout afficher (${hid.length} masquée${hid.length > 1 ? "s" : ""})`, keys: "Maj+H", icon: "eye", run: showAll }] : [];
    if (!inst) return [...back, { label: "Ajouter une pièce ou un sous-assemblage…", icon: "plus", run: () => addDialog() }];
    const name = what(inst).name, flag = (key, on, word) => store.updateAssembly(id, (x) => { const i = x.instances.find((q) => q.id === iid); if (on) i[key] = true; else delete i[key]; }, `${name} ${word}`);
    const RUN = { open: () => openPart(iid), alone: () => isolate(iid), all: showAll, hide: () => hide(iid), show: () => flag("hidden", false, "à l'écran"), off: () => flag("off", true, "à Off"), on: () => flag("off", false, "à On"),
      fix: () => flag("fixed", true, "fixe"), free: () => flag("fixed", false, "libre"), form: () => formFrom([iid]), dissolve: () => dissolve(iid), remove: () => dropInst(iid),
      look: () => openInstLookPicker(id, iid, left.querySelector(`[data-inst="${CSS.escape(iid)}"] .look-dot`) || left) };
    return instanceMenu(asm(), iid, name).map((it) => (it && it.act ? { ...it, run: RUN[it.act] } : it));      // one menu, on the line of the list and on the part in the view
  }
  function instKey(e) {
    const k = e.key.toLowerCase();
    if (k === "h" && e.shiftKey) { if (hiddenOnes().length) showAll(); }
    else if (!st.sel) return;
    else if (k === "h") hide(st.sel); else if (k === "i") isolate(st.sel); else if (k === "enter") openPart(st.sel); else if (k === "delete" || k === "backspace") dropInst(st.sel);
  }
  function instTab(body, a) {
    const inst = a.instances.find((i) => i.id === st.sel);
    if (!inst) { body.append(el("p", { class: "muted" }, "Cliquez une pièce dans la vue 3D ou dans la liste.")); return; }
    if (inst.off) { const waits = (a.mates || []).filter((k) => topOf(k.a.inst) === inst.id || topOf(k.b.inst) === inst.id).length;      // put aside : nothing of it is built — what it is, and the way back
      body.append(el("h3", null, what(inst).name), el("p", { class: "atelier-hint" }, icon("info"), ` Cette pièce est à Off : elle reste dans l'assemblage avec sa place${waits ? ` et ${waits > 1 ? `ses ${waits} accouplements` : "son accouplement"}` : ""}, mais elle n'est ni dans la vue, ni dans la nomenclature, ni dans la masse, ni dans les dessins et les exports.`),
        el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, btn("Remettre à On", () => store.updateAssembly(id, (x) => { setInstOff(x, inst.id, false); }, `${what(inst).name} à On`), { small: true, primary: true, icon: "power" }),
          btn("Retirer", () => store.updateAssembly(id, (x) => without(x, inst.id), `${what(inst).name} : retrait de ${id}`), { small: true, icon: "trash", danger: true }))); return; }
    if (isSub(inst)) { subTab(body, { inst, ctx: st.ctx, remove: () => dropInst(inst.id), dissolve: () => dissolve(inst.id), fix: () => store.updateAssembly(id, (x) => { const i = x.instances.find((q) => q.id === inst.id); if (i.fixed) delete i.fixed; else i.fixed = true; }, `${what(inst).name} ${inst.fixed ? "libre" : "fixe"}`),
      move: (k, v) => store.updateAssembly(id, (x) => { const i = x.instances.find((q) => q.id === inst.id); i.placement = i.placement || { t: [0, 0, 0], r: [0, 0, 0] }; i.placement.t[k] = v; }, `${what(inst).name} : position`) }); body.append(instLookSection(id, inst)); const turn = turner.section(); if (turn) body.append(turn); return; }
    const spec = store.part(inst.part), b = st.ctx.built[inst.part], m = st.ctx.sol.placements[inst.id];
    if (!spec || !b) { body.append(el("h3", null, inst.part), el("p", { class: "form-error" }, "Cette pièce n'est plus dans le projet, ou n'a pas pu être construite."), el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, btn("Retirer", () => dropInst(inst.id), { small: true, icon: "trash", danger: true }))); return; }
    body.append(el("h3", null, spec.name || spec.id), el("p", { class: "muted", style: { fontSize: ".84rem" } }, `${spec.id} · occurrence ${inst.id} · ${fmtMass(b.mass)} · position ${fmtDims([m[12], m[13], m[14]], 1).replace(/ × /g, " ; ")}`),
      el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, el("a", { class: "btn btn-small btn-primary", href: `#/${spec.family === "pcb" ? "pcb" : spec.family === "extrusion" ? "extrusion" : "parts"}/${encodeURIComponent(spec.id)}` }, icon("edit"), "Ouvrir la pièce"),
        btn(inst.fixed ? "Libérer" : "Fixer", () => store.updateAssembly(id, (x) => { const i = x.instances.find((q) => q.id === inst.id); if (i.fixed) delete i.fixed; else i.fixed = true; }, `${inst.part} ${inst.fixed ? "libérée" : "fixée"}`), { small: true, icon: "lock" }),
        spec.fill ? btn("Recalculer", () => { const host = a.instances.find((q) => q.id === spec.fill.of); if (host) import("./asm_fill.js").then((m) => m.openFill(id, host.id, st.ctx, spec.id)); else toast("Le contenant de ce remplissage n'est plus dans l'assemblage.", "warn"); }, { small: true, icon: "refresh", tip: "Reprendre le volume libre avec les pièces telles qu'elles sont posées aujourd'hui" })
          : btn("Remplir sa cavité…", () => import("./asm_fill.js").then((m) => m.openFill(id, inst.id, st.ctx)), { small: true, icon: "layers", tip: "Mousse, résine ou composé thermique : le volume laissé libre par les pièces posées devient une pièce de l'assemblage" }),
        btn("Retirer", () => store.updateAssembly(id, (x) => without(x, inst.id), `${inst.part} retirée de ${id}`), { small: true, icon: "trash", danger: true })));
    body.append(el("div", { class: "side-section" }, el("h3", null, "Interfaces"), b.interfaces.map((it) => {
      const mate = (a.mates || []).find((k) => (k.a.inst === inst.id && k.a.iface === it.id) || (k.b.inst === inst.id && k.b.iface === it.id));
      return el("p", { style: { fontSize: ".86rem", margin: "0 0 .3rem" } }, badge(it.side, it.side === "B" ? "b" : "a"), " ", el("b", null, it.name), mate ? ` — matée (${mate.id})` : " — libre");
    }), !b.interfaces.length && el("p", { class: "muted" }, "Cette pièce n'a pas d'interface : elle ne peut pas se mater. Ajoutez-en dans le Part Studio.")));
    body.append(instLookSection(id, inst));      // what it shows here, and what its part shows everywhere
    const turn = turner.section(); if (turn) body.append(turn);      // its orientation : the angle the handle of the view turns, as a number
    if (!st.ctx.sol.placedBy[inst.id] && !inst.fixed) {
      const t = (inst.placement && inst.placement.t) || [0, 0, 0];
      body.append(el("div", { class: "side-section" }, el("h3", null, "Position manuelle"), el("div", { class: "form-row" }, ["X", "Y", "Z"].map((ax, k) => { const u = unitInput(ax, { value: t[k], step: "1" }, (v) => store.updateAssembly(id, (x) => { const i = x.instances.find((q) => q.id === inst.id); i.placement = i.placement || { t: [0, 0, 0], r: [0, 0, 0] }; i.placement.t[k] = v || 0; }, `${inst.part} déplacée`), { event: "onChange", length: true });
        return el("label", { class: "field", style: { minWidth: "70px" } }, el("span", { class: "field-label" }, u.label), u.input); }))));
    }
  }
  function bomTab(body, a) {
    const rows = st.ctx.bom, deep = (st.ctx.levels || []).some((r) => r.kind === "assembly"), byLevel = deep && st.bom !== "flat", lv = byLevel ? levelRows(st.ctx, a) : [];
    /* an assembly that holds sub-assemblies reads two ways : by level (each sub-assembly one line, its content under it), or flat (every part through the levels, summed) */
    if (deep) body.append(el("div", { class: "seg text", role: "group", "aria-label": "Lecture de la nomenclature", style: { margin: "0 0 .5rem" } }, [["levels", "Par niveaux", "Chaque sous-assemblage est une ligne ; ce qu'UN exemplaire contient vient dessous"], ["flat", "À plat", "Toutes les pièces à travers les niveaux, quantités additionnées"]].map(([k, l, tip]) =>
      el("button", { class: "seg-btn" + ((k === "levels") === byLevel ? " on" : ""), type: "button", "aria-pressed": (k === "levels") === byLevel ? "true" : "false", "data-tip": tip, onClick: () => { st.bom = k; renderRight(); } }, l))));
    if (byLevel) { body.append(levelTable(lv), el("div", { class: "form-actions" }, btn("BOM par niveaux en CSV", () => download(`${id}${tagNow()}_BOM_niveaux.csv`, levelCsv(lv), "text/csv"), { small: true, icon: "download" })),
      el("div", { class: "kpis", style: { marginTop: ".8rem" } }, el("div", { class: "kpi" }, el("b", null, fmtMass(st.ctx.mass.mass)), el("span", null, "Masse des pièces")), el("div", { class: "kpi" }, el("b", null, st.ctx.mass.cog.map((x) => fmt(x, 0)).join(" ; ")), el("span", null, "Centre de gravité (mm)")))); return; }
    body.append(el("p", { class: "muted", style: { fontSize: ".84rem" } }, "Les vis, inserts, écrous et goupilles sont déduits des interfaces matées (taille, quantité, longueur selon l'épaisseur serrée)."),
      table(["#", "Référence", "Désignation", "Qté"], rows.map((r) => [String(r.item), el("code", null, r.id), r.name, String(r.qty)])),
      el("div", { class: "form-actions" }, btn("BOM en CSV", () => download(`${id}${tagNow()}_BOM.csv`, "﻿Item;Reference;Designation;Quantite;Materiau;Procede;Masse_g\n" + rows.map((r) => [r.item, r.id, `"${(r.name || "").replace(/"/g, '""')}"`, r.qty, r.material, r.process, r.mass === null ? "" : r.mass.toFixed(1)].join(";")).join("\n"), "text/csv"), { small: true, icon: "download" })),
      el("div", { class: "kpis", style: { marginTop: ".8rem" } }, el("div", { class: "kpi" }, el("b", null, fmtMass(st.ctx.mass.mass)), el("span", null, "Masse des pièces")), el("div", { class: "kpi" }, el("b", null, st.ctx.mass.cog.map((x) => fmt(x, 0)).join(" ; ")), el("span", null, "Centre de gravité (mm)"))));
  }
  function dfaTab(body) {
    const d = st.dfa;
    if (st.ctx.errors.length) body.append(st.ctx.errors.map((e) => el("p", { class: "form-error" }, e)));
    for (const p of st.ctx.sol.problems) body.append(el("div", { class: "finding error" }, el("span", { class: "sev" }), el("div", null, el("b", null, "Mate incohérent")), el("p", null, p.msg + " Correctif : vérifiez la position ou la rotation des interfaces, ou supprimez ce mate.")));
    for (const x of st.interference || []) body.append(el("div", { class: "finding error" }, el("span", { class: "sev" }), el("div", null, el("b", null, "Interférence"), el("span", { class: "id" }, "ASM-01")), el("p", null, `${x.a} et ${x.b} ont ${fmt(x.volume, 0)} mm³ en commun. Correctif : ajustez l'une des deux pièces ou le jeu de l'interface.`)));
    if (st.interference === null) body.append(el("p", { class: "muted", style: { fontSize: ".84rem" } }, "Interférences : non vérifiées (bouton « Interférences » dans la vue)."));
    if (!d || d.unavailable) { body.append(el("p", { class: "muted" }, "Le moteur DFA n'est pas chargé dans cette version.")); return; }
    if (d.metrics && Object.keys(d.metrics).length) body.append(el("div", { class: "kpis" }, Object.entries({ instances: "Pièces", uniqueParts: "Pièces uniques", fasteners: "Fixations", fastenerTypes: "Types de fixation", directions: "Directions de montage" }).filter(([k]) => d.metrics[k] !== undefined).map(([k, l]) => el("div", { class: "kpi" }, el("b", null, String(d.metrics[k])), el("span", null, l)))));
    for (const f of d.findings) body.append(el("div", { class: `finding ${f.severity}` }, el("span", { class: "sev" }), el("div", null, el("b", null, f.title), el("span", { class: "id" }, f.id)), el("p", null, inUnits(f.message))));
    if (!d.findings.length) body.append(el("div", { class: "card" }, icon("check"), " Aucune remarque DFA."));
  }

  app.commands = [{ label: "Assemblage : mater automatiquement", hint: "assemblage", icon: "sparkle", keys: "mate auto assembler", run: () => store.commit(`${id} : mates automatiques`, (p) => autoMate(p.assemblies.find((x) => x.id === id), st.ctx.built, st.ctx.asm), { assembly: id }) },
    { label: "Assemblage : exporter le STEP", hint: "assemblage", icon: "step", keys: "step export", run: exportStep }, { label: "Assemblage : former un sous-assemblage…", hint: "assemblage", icon: "assembly", keys: "sous-assemblage module bloc former grouper niveaux", run: () => formFrom(st.sel ? [st.sel] : []) }, { label: "Assemblage : chercher les interférences", hint: "assemblage", icon: "warning", keys: "interference collision", run: checkInterference }];
  return () => { off(); pins.dispose(); st.token++; vp.dispose(); };
}

registerModule({ key: "assembly", label: "Assemblage", icon: "assembly", tip: "Les pièces se matent par leurs interfaces ; mates liés, éclaté, BOM, interférences", render });
