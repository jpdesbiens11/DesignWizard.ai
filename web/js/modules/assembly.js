/* DesignWizard.ai — Assemblage: add parts and they mate themselves through their interfaces. A linked mate is a
   dependency: change one side, the other part adapts. Exploded view, BOM with the implied hardware, interference
   check, complementary-part generator, STEP of the assembly, and the assembly routing step by step (asm_gamme.js). */

import { el, clear, icon, btn, badge, toast, modal, fmt, fmtMass, download, promptBox, confirmBox, table } from "../core/dom.js";
import { registerModule, go, setStatus, app } from "../core/app.js";
import { store } from "../core/store.js";
import { lookSwatch } from "./part_look.js";
import { kernel } from "../cad/client.js";
import { createViewport } from "../core/viewport.js";
import { mountPins } from "./view_pins.js";
import { buildAssembly, showAssembly } from "../core/asm_scene.js";
import { autoMate, candidates, freeInterfaces, ifaceOf, pairKey, joints, jointsCsv, nextJoint } from "../core/assembly_logic.js";
import { assemblyHealth, HEALTH } from "../core/joint_health.js";
import { announceLinks } from "../core/part_edit.js";
import { companionSpec } from "../core/companion.js";
import { runDfa } from "../analysis/dfx_api.js";
import { matPoint, matDir, bboxTransform } from "../cad/vec.js";
import { INTERFACE_TYPES } from "../cad/interfaces.js";
import { gammeTab, showWhole } from "./asm_gamme.js";
import { mateTree, mateFind, mateLabels } from "../core/asm_tree.js";
import { mateSection } from "./asm_tree.js";
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
  const vp = createViewport(view, { name: () => id, explode: true, explodeScale: () => (st.ctx ? Math.max(20, (st.ctx.bbox[5] - st.ctx.bbox[2] + st.ctx.bbox[3] - st.ctx.bbox[0]) * 0.25) : 50),
    menuFor: (hit) => [...instMenu(hit && hit.def.data.inst ? hit.def.data.inst : null), ...(hit && hit.def.data.inst ? ["—", ...pins.menu(hit)] : [])], onKey: (e) => instKey(e), keys: [["H · I · Maj + H", "Masquer la pièce choisie · l'isoler · tout afficher"], ["Entrée · Suppr", "Ouvrir la pièce choisie · la retirer de l'assemblage"]],
    onPick: (hit) => { st.sel = hit && hit.def.data.inst ? hit.def.data.inst : null; vp.viewer.highlight(st.sel ? [...vp.viewer.objects.keys()].filter((k) => k.startsWith(st.sel + "/")) : []); renderLeft(); if (st.sel) { st.tab = "inst"; } renderRight(); } });
  const pins = mountPins(vp, { key: () => `assembly:${id}` });      // the messages pinned on this assembly, each on its instance
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
    vp.setBusy(st.ctx ? "" : "Construction de l'assemblage…");
    try {
      const ctx = await buildAssembly(a, (t) => vp.setBusy(st.ctx ? "" : t));
      if (token !== st.token) return;
      // a part was just added: mate what can be mated, then solve again (one more undo step)
      const cand = candidates(ctx.asm, ctx.built);
      if (cand.length && st.autoFor !== JSON.stringify(a.instances.map((i) => i.id))) {
        st.autoFor = JSON.stringify(a.instances.map((i) => i.id));
        let added = [];
        const master = ctx.asm.instances.find((i) => i.fixed) || ctx.asm.instances[0];
        store.commit(`${id} : mates automatiques`, (p) => { added = autoMate(p.assemblies.find((x) => x.id === id), ctx.built); }, { assembly: id, part: master && master.part });
        if (added.length) { toast(`${added.length} mate(s) créé(s) automatiquement à partir des interfaces.`, "success", 5000); return; }
      }
      st.ctx = ctx;
      showAssembly(vp.viewer, ctx);
      if (!st.fitted) { st.fitted = true; vp.viewer.view("iso"); } else vp.viewer.invalidate();
      vp.setBusy("");
      const s = ctx.sol;
      info.textContent = `${ctx.asm.instances.length} pièce(s) · ${(a.mates || []).length} mate(s) · ${fmtMass(ctx.mass.mass)} · ${fmt(ctx.bbox[3] - ctx.bbox[0], 0)} × ${fmt(ctx.bbox[4] - ctx.bbox[1], 0)} × ${fmt(ctx.bbox[5] - ctx.bbox[2], 0)} mm`
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
    const tree = mateTree(a, (health() || { rows: [] }).rows, (i) => instName(a, i)), labelled = st.frames ? tree.flatMap((g) => g.items.map((it) => ({ ...it, selected: it.id === st.mate }))) : mateLabels(tree, st.showMates, st.mate);
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
    const mine = st.token; if (!quiet) vp.setBusy(`Recherche d'interférences sur ${pairs.length} paire(s)…`);
    try {
      const res = await kernel.interference(pairs); if (mine !== st.token) return;
      st.interference = res.map((r, k) => ({ ...r, a: names[k][0].part, b: names[k][1].part, ia: names[k][0].id, ib: names[k][1].id })).filter((r) => r.volume > 0.5);
      showHealth(); if (st.tab === "mates") renderRight();
      clash.textContent = st.interference.length ? `${st.interference.length} interférence(s)` : "aucune interférence"; clash.className = `chip ${st.interference.length ? "bad" : "done"}`; clash.dataset.tip = st.interference.length ? st.interference.map((r) => `${r.a} ∩ ${r.b} : ${fmt(r.volume, 1)} mm³`).join(" · ") : `${pairs.length} paire(s) de pièces voisines comparées`;
      if (!quiet || st.interference.length) toast(st.interference.length ? `${st.interference.length} interférence(s) trouvée(s) : ${st.interference.map((r) => `${r.a} ∩ ${r.b}`).slice(0, 3).join(", ")}.` : "Aucune interférence entre les pièces.", st.interference.length ? "warn" : "success");
      if (!quiet) st.tab = "dfa";
    } catch (e) { if (!quiet) toast(e.message, "error"); }
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
    const sec = el("div", { class: "side-section" }, el("h3", null, el("span", { class: "grow" }, `Pièces de l'assemblage (${a.instances.length})`), btn("", () => addDialog(), { small: true, icon: "plus", tip: "Ajouter une pièce du projet" })));
    for (const inst of a.instances) {
      const spec = store.part(inst.part), placed = st.ctx && st.ctx.sol.placedBy[inst.id];
      sec.append(el("div", { class: "nav-item" + (st.sel === inst.id ? " active" : "") + (inst.hidden ? " off" : ""), role: "button", tabindex: "0", onClick: () => { st.sel = inst.id; st.tab = "inst"; vp.viewer.highlight([...vp.viewer.objects.keys()].filter((k) => k.startsWith(inst.id + "/"))); renderLeft(); renderRight(); } },
        icon(spec && spec.family === "pcb" ? "pcb" : spec && spec.family === "extrusion" ? "extrusion" : "part"), el("span", { class: "grow" }, spec ? spec.name || spec.id : `${inst.part} (absente)`), spec ? lookSwatch(spec) : null,
        inst.fixed ? badge("fixe", "neutral") : placed ? badge("matée", "ok") : badge("libre", "warn"),
        iconBtn(inst.hidden ? "eye-off" : "eye", inst.hidden ? "Afficher" : "Masquer", () => store.updateAssembly(id, (x) => { const i = x.instances.find((q) => q.id === inst.id); if (i.hidden) delete i.hidden; else i.hidden = true; }, `${inst.part} ${inst.hidden ? "affichée" : "masquée"}`))));
    }
    if (!a.instances.length) sec.append(el("p", { class: "muted" }, "Ajoutez une première pièce : elle sera la pièce fixe."));
    scroll.append(sec);
    if (st.ctx) scroll.append(el("div", { class: "side-section" }, el("h3", null, `Accouplements (${(a.mates || []).length})`),
      mateSection({ tree: mateTree(a, (health() || { rows: [] }).rows, (i) => instName(a, i)), sel: st.mate, show: st.showMates, select: selectMate,
        hover: (it) => { if (!st.mate) vp.viewer.highlight(it ? [...vp.viewer.objects.keys()].filter((k) => k.startsWith(it.a.inst + "/") || k.startsWith(it.b.inst + "/")) : []); },
        relabel: (k, on) => { st.showMates[k] = on; renderLeft(); overlays(); } }),
      el("p", { class: "muted small" }, "Un clic sur un accouplement allume ses deux pièces et ouvre sa fiche à droite ; l'œil d'un état affiche ou masque ses étiquettes sur le modèle.")));
    scroll.append(el("div", { class: "side-section" }, el("h3", null, "Assemblage"),
      btn("STEP", () => exportStep(), { small: true, icon: "step", tip: "Télécharger le STEP AP214 de l'assemblage (pièces nommées, positions résolues)" }), " ",
      btn("Envoyer vers Onshape", () => go(`#/onshape/${encodeURIComponent(id)}`), { small: true, icon: "onshape" }), " ",
      btn("Supprimer", async () => { if (await confirmBox("Supprimer l'assemblage", `Supprimer ${id} ? Les pièces restent dans le projet.`, "Supprimer", true)) { store.commit(`Assemblage supprimé : ${id}`, (p) => { p.assemblies = p.assemblies.filter((x) => x.id !== id); }); go("#/assembly"); } }, { small: true, icon: "trash", danger: true })));
  }
  /** Selects a mate (null : none) : its two parts light up, its label shows, its card opens on the right. */
  function selectMate(mid) {
    st.mate = mid; const it = mid && st.ctx ? mateFind(mateTree(st.ctx.asm, (health() || { rows: [] }).rows), mid) : null;
    vp.viewer.highlight(it ? [...vp.viewer.objects.keys()].filter((k) => k.startsWith(it.a.inst + "/") || k.startsWith(it.b.inst + "/")) : []);
    if (it) { st.sel = null; st.tab = "mates"; } renderLeft(); renderRight(); overlays();
    if (it) setTimeout(() => nudge(right.querySelector(`[data-mate="${mid}"]`)), 80);
  }
  function iconBtn(name, tip, fn) {
    const b = el("button", { class: "icon-btn", type: "button", "data-tip": tip, "aria-label": tip, onClick: (e) => { e.stopPropagation(); fn(); } }, icon(name));
    b.style.fontSize = "1rem"; b.style.padding = "0 .15rem";
    return b;
  }
  function addDialog() {
    const m = modal("Ajouter une pièce à l'assemblage", [el("p", { class: "muted" }, "La pièce se place d'elle-même si l'une de ses interfaces correspond à une interface libre de l'assemblage (même type, même clé ou même géométrie, côtés A et B)."),
      el("div", { class: "grid" }, store.parts.map((p) => el("button", { class: "card lift", type: "button", onClick: () => { m.close(); addInstance(p.id); } }, el("h3", null, icon(p.family === "pcb" ? "pcb" : "part"), " ", p.name || p.id),
        el("p", { class: "muted", style: { margin: 0, fontSize: ".82rem" } }, `${p.id} · ${(p.interfaces || []).length} interface(s)`)))),
      !store.parts.length && el("p", null, "Le projet n'a pas encore de pièce.")], { wide: true });
  }
  function addInstance(partId) {
    store.updateAssembly(id, (a) => {
      let n = a.instances.length + 1, iid; do { iid = `i${n++}`; } while (a.instances.some((i) => i.id === iid));
      a.instances.push({ id: iid, part: partId, fixed: a.instances.length === 0 || undefined, placement: { t: [0, 0, 0], r: [0, 0, 0] } });
    }, `${partId} ajoutée à ${id}`);
  }
  async function exportStep() {
    if (!st.ctx) return;
    try {
      const items = st.ctx.asm.instances.map((i) => { const s = store.part(i.part); return { key: i.part, name: `${i.part} ${s.name || ""}`.trim(), instanceName: `${i.part} ${i.id}`, matrix: st.ctx.sol.placements[i.id] }; });
      download(`${id}.step`, await kernel.step(items, `${id} ${asm().name || ""}`.trim()), "application/step");
    } catch (e) { toast(e.message, "error"); }
  }

  /* ---------- right ---------- */
  function renderRight() {
    clear(right);
    const a = asm(), tabs = [["mates", "Mates"], ["inst", "Pièce"], ["bom", "BOM"], ["dfa", "DFA"], ["gamme", "Gamme"]];
    if (st.tab !== "gamme" && st.step) { st.step = null; showWhole(vp); }      // leaving the routing sheet : the whole product again
    const nErr = st.dfa && st.dfa.summary ? st.dfa.summary.errors : 0;
    right.append(el("div", { class: "side-head" }, el("h2", null, a.name || id)), el("div", { class: "subtabs", style: { margin: "0 .6rem" } }, tabs.map(([k, l]) => el("button", { class: "subtab" + (st.tab === k ? " active" : ""), type: "button", onClick: () => { st.tab = k; renderRight(); } }, l, k === "dfa" && nErr ? ` (${nErr})` : ""))));
    const body = el("div", { class: "side-scroll" });
    right.append(body);
    if (!st.ctx) { body.append(el("p", { class: "muted" }, "Construction…")); return; }
    ({ mates: matesTab, inst: instTab, bom: bomTab, dfa: dfaTab, gamme: (b, x) => gammeTab(b, x, { st, vp, id }) })[st.tab](body, a);
  }
  const instName = (a, iid) => { const i = a.instances.find((x) => x.id === iid), s = i && store.part(i.part); return s ? s.name || s.id : iid; };
  function matesTab(body, a) {
    const { built, sol } = st.ctx, cand = candidates(st.ctx.asm, built, true);
    body.append(el("p", { class: "muted", style: { fontSize: ".84rem" } }, "Un mate relie deux interfaces identiques (côté A et côté B). S'il est lié 🔗, les deux pièces partagent les paramètres de l'interface : modifiez un côté, l'autre s'adapte."));
    if (cand.length) {
      body.append(el("div", { class: "side-section" }, el("h3", null, el("span", { class: "grow" }, `Mates possibles (${cand.length})`), btn("Tout mater", () => { store.commit(`${id} : mates automatiques`, (p) => autoMate(p.assemblies.find((x) => x.id === id), built), { assembly: id, part: (a.instances.find((i) => i.fixed) || a.instances[0]).part }); }, { small: true, icon: "sparkle" })),
        cand.slice(0, 12).map((c) => el("div", { class: "finding", onClick: () => store.updateAssembly(id, (x) => { x.mates = x.mates || []; const n = nextJoint(x); x.mates.push({ id: `M${n}`, a: c.a, b: c.b, linked: true, by: c.by, ...(c.flip ? { flip: true } : {}) }); x.mseq = n;
          x.rejected = (x.rejected || []).filter((k) => k !== pairKey(c.a, c.b)); }, `Mate ajouté : ${c.label}`) },
          el("span", { class: "sev" }), el("div", null, el("b", null, `${instName(a, c.a.inst)} ↔ ${instName(a, c.b.inst)}`)), el("p", null, `${c.label} · ${c.by === "key" ? "même clé" : "même géométrie"}${c.same ? "" : " · paramètres différents : le côté B s'adaptera"}${c.rejected ? " · retiré à la main : cliquez pour le remettre" : ""}`)))));
    }
    /* the joint register : each mated pair keeps its number, says what kind of joint it is and what holds it */
    const reg = joints(st.ctx.asm, built, Object.fromEntries(store.parts.map((x) => [x.id, x]))), byId = new Map(reg.map((r) => [r.id, r])), H = health(), hOf = new Map(H.rows.map((r) => [r.id, r]));
    for (const r of reg) { const h = hOf.get(r.id); if (h) { r.health = HEALTH[h.state].fr; r.notes = h.notes; } }
    body.append(el("p", { class: `atelier-hint${H.state === "ok" ? "" : " warn"}`, style: { fontSize: ".84rem" } }, icon(H.state === "ok" ? "check" : "warning"), ` Santé des accouplements — ${H.text}.`));
    body.append(el("div", { class: "side-section" }, el("h3", null, el("span", { class: "grow" }, `Joints (${(a.mates || []).length})`), reg.length ? btn("Registre (.csv)", () => download(`${id}-joints.csv`, jointsCsv(reg), "text/csv"), { small: true, icon: "download", tip: "Le registre des joints : numéro, genre, pièces, clé, visserie ou colle, procédé" }) : null)));
    for (const m of a.mates || []) {
      const ia = a.instances.find((i) => i.id === m.a.inst), fa = ia && ifaceOf(built, ia.part, m.a.iface), pb = sol.problems.find((p) => p.mate === m.id);
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
  const showAll = () => store.updateAssembly(id, (x) => { for (const i of x.instances) delete i.hidden; }, `${id} : toutes les pièces affichées`);
  const hide = (iid) => store.updateAssembly(id, (x) => { x.instances.find((q) => q.id === iid).hidden = true; }, `${iid} masquée`);
  const isolate = (iid) => store.updateAssembly(id, (x) => { for (const i of x.instances) { if (i.id === iid) delete i.hidden; else i.hidden = true; } }, `${iid} isolée`);
  const openPart = (iid) => { const inst = asm().instances.find((i) => i.id === iid), spec = inst && store.part(inst.part); if (spec) go(`#/${spec.family === "pcb" ? "pcb" : spec.family === "extrusion" ? "extrusion" : "parts"}/${encodeURIComponent(spec.id)}`); };
  const dropInst = async (iid) => { const inst = asm().instances.find((i) => i.id === iid); if (!inst || !(await confirmBox("Retirer la pièce", `Retirer ${inst.part} de ${id} ? Ses liaisons partent avec elle. (Ctrl + Z pour revenir.)`, "Retirer", true))) return;
    store.updateAssembly(id, (x) => { x.instances = x.instances.filter((q) => q.id !== iid); x.mates = (x.mates || []).filter((k) => k.a.inst !== iid && k.b.inst !== iid); }, `${inst.part} retirée de ${id}`); st.sel = null; };
  function instMenu(iid) {
    const inst = iid ? asm().instances.find((i) => i.id === iid) : null, hid = hiddenOnes(), back = hid.length ? [{ label: `Tout afficher (${hid.length} masquée${hid.length > 1 ? "s" : ""})`, keys: "Maj+H", icon: "eye", run: showAll }] : [];
    if (!inst) return [...back, { label: "Ajouter une pièce…", icon: "plus", run: () => addDialog() }];
    const spec = store.part(inst.part);
    return [{ title: `${spec ? spec.name || spec.id : inst.part} · ${inst.id}` }, { label: "Ouvrir la pièce", keys: "Entrée", icon: "edit", run: () => openPart(iid) },
      { label: inst.fixed ? "Libérer" : "Fixer", icon: "lock", run: () => store.updateAssembly(id, (x) => { const i = x.instances.find((q) => q.id === iid); if (i.fixed) delete i.fixed; else i.fixed = true; }, `${inst.part} ${inst.fixed ? "libérée" : "fixée"}`) },
      { label: "Masquer", keys: "H", icon: "eye-off", run: () => hide(iid) }, { label: "Isoler", keys: "I", icon: "eye", run: () => isolate(iid) }, ...back,
      { label: "Retirer de l'assemblage", keys: "Suppr", icon: "trash", run: () => dropInst(iid) }];
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
    const spec = store.part(inst.part), b = st.ctx.built[inst.part], m = st.ctx.sol.placements[inst.id];
    body.append(el("h3", null, spec.name || spec.id), el("p", { class: "muted", style: { fontSize: ".84rem" } }, `${spec.id} · occurrence ${inst.id} · ${fmtMass(b.mass)} · position ${[m[12], m[13], m[14]].map((x) => fmt(x, 1)).join(" ; ")}`),
      el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, el("a", { class: "btn btn-small btn-primary", href: `#/${spec.family === "pcb" ? "pcb" : spec.family === "extrusion" ? "extrusion" : "parts"}/${encodeURIComponent(spec.id)}` }, icon("edit"), "Ouvrir la pièce"),
        btn(inst.fixed ? "Libérer" : "Fixer", () => store.updateAssembly(id, (x) => { const i = x.instances.find((q) => q.id === inst.id); if (i.fixed) delete i.fixed; else i.fixed = true; }, `${inst.part} ${inst.fixed ? "libérée" : "fixée"}`), { small: true, icon: "lock" }),
        spec.fill ? btn("Recalculer", () => { const host = a.instances.find((q) => q.id === spec.fill.of); if (host) import("./asm_fill.js").then((m) => m.openFill(id, host.id, st.ctx, spec.id)); else toast("Le contenant de ce remplissage n'est plus dans l'assemblage.", "warn"); }, { small: true, icon: "refresh", tip: "Reprendre le volume libre avec les pièces telles qu'elles sont posées aujourd'hui" })
          : btn("Remplir sa cavité…", () => import("./asm_fill.js").then((m) => m.openFill(id, inst.id, st.ctx)), { small: true, icon: "layers", tip: "Mousse, résine ou composé thermique : le volume laissé libre par les pièces posées devient une pièce de l'assemblage" }),
        btn("Retirer", () => store.updateAssembly(id, (x) => { x.instances = x.instances.filter((q) => q.id !== inst.id); x.mates = (x.mates || []).filter((k) => k.a.inst !== inst.id && k.b.inst !== inst.id); }, `${inst.part} retirée de ${id}`), { small: true, icon: "trash", danger: true })));
    body.append(el("div", { class: "side-section" }, el("h3", null, "Interfaces"), b.interfaces.map((it) => {
      const mate = (a.mates || []).find((k) => (k.a.inst === inst.id && k.a.iface === it.id) || (k.b.inst === inst.id && k.b.iface === it.id));
      return el("p", { style: { fontSize: ".86rem", margin: "0 0 .3rem" } }, badge(it.side, it.side === "B" ? "b" : "a"), " ", el("b", null, it.name), mate ? ` — matée (${mate.id})` : " — libre");
    }), !b.interfaces.length && el("p", { class: "muted" }, "Cette pièce n'a pas d'interface : elle ne peut pas se mater. Ajoutez-en dans le Part Studio.")));
    if (!st.ctx.sol.placedBy[inst.id] && !inst.fixed) {
      const t = (inst.placement && inst.placement.t) || [0, 0, 0];
      body.append(el("div", { class: "side-section" }, el("h3", null, "Position manuelle"), el("div", { class: "form-row" }, ["X", "Y", "Z"].map((ax, k) => el("label", { class: "field", style: { minWidth: "70px" } }, el("span", { class: "field-label" }, ax),
        el("input", { type: "number", value: t[k], step: "1", onChange: (e) => store.updateAssembly(id, (x) => { const i = x.instances.find((q) => q.id === inst.id); i.placement = i.placement || { t: [0, 0, 0], r: [0, 0, 0] }; i.placement.t[k] = parseFloat(e.target.value) || 0; }, `${inst.part} déplacée`) }))))));
    }
  }
  function bomTab(body) {
    const rows = st.ctx.bom;
    body.append(el("p", { class: "muted", style: { fontSize: ".84rem" } }, "Les vis, inserts, écrous et goupilles sont déduits des interfaces matées (taille, quantité, longueur selon l'épaisseur serrée)."),
      table(["#", "Référence", "Désignation", "Qté"], rows.map((r) => [String(r.item), el("code", null, r.id), r.name, String(r.qty)])),
      el("div", { class: "form-actions" }, btn("BOM en CSV", () => download(`${id}_BOM.csv`, "﻿Item;Reference;Designation;Quantite;Materiau;Procede;Masse_g\n" + rows.map((r) => [r.item, r.id, `"${(r.name || "").replace(/"/g, '""')}"`, r.qty, r.material, r.process, r.mass === null ? "" : r.mass.toFixed(1)].join(";")).join("\n"), "text/csv"), { small: true, icon: "download" })),
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
    for (const f of d.findings) body.append(el("div", { class: `finding ${f.severity}` }, el("span", { class: "sev" }), el("div", null, el("b", null, f.title), el("span", { class: "id" }, f.id)), el("p", null, f.message)));
    if (!d.findings.length) body.append(el("div", { class: "card" }, icon("check"), " Aucune remarque DFA."));
  }

  app.commands = [{ label: "Assemblage : mater automatiquement", hint: "assemblage", icon: "sparkle", keys: "mate auto assembler", run: () => store.commit(`${id} : mates automatiques`, (p) => autoMate(p.assemblies.find((x) => x.id === id), st.ctx.built), { assembly: id }) },
    { label: "Assemblage : exporter le STEP", hint: "assemblage", icon: "step", keys: "step export", run: exportStep }, { label: "Assemblage : chercher les interférences", hint: "assemblage", icon: "warning", keys: "interference collision", run: checkInterference }];
  return () => { off(); pins.dispose(); st.token++; vp.dispose(); };
}

registerModule({ key: "assembly", label: "Assemblage", icon: "assembly", tip: "Les pièces se matent par leurs interfaces ; mates liés, éclaté, BOM, interférences", render });
