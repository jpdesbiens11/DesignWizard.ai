/* DesignWizard.ai — Isolation (Creepage & Clearance): the geometry analysed is the COMPLETE assembly, or ONE board alone (demande de
   JP : « analyse PCBA ou analyse Assy » — the menu « Ce que l'on analyse », modules/creepage_board.js). Each body is a
   conductor of a net, a floating conductor or an insulator of a material group; for every pair of nets the required
   distances come from IEC 60664-1 (cc_rules) and the measured ones from the shortest paths on the model (cc_paths).
   Paths are drawn in red: full line = clearance [clr] through air, dashed = creepage [crp] along the surfaces.
   A board alone is its real copper — pads, tracks, vias of the two outer layers — grouped by potential (pcba/board_iso.js). */

import { el, clear, icon, btn, badge, field, toast, fmt, modal, table } from "../core/dom.js";
import { registerModule, go, setStatus, setGuide } from "../core/app.js";
import { netsOf, isolationGuide } from "../analysis/cc_guide.js";
import { store } from "../core/store.js";
import { flatAsm } from "../core/asm_levels.js";
import { createViewport } from "../core/viewport.js";
import { buildAssembly, showAssembly } from "../core/asm_scene.js";
import { kernel } from "../cad/client.js";
import { sceneBody } from "../analysis/cc_scene.js";
import { bodyGroups } from "../analysis/cc_groups.js";
import { charredEdge } from "../cad/special_processes.js";
import { BUILTIN, DEFAULT_PARAMS, requirement, floatingSpan, altLabel, LEVEL_LABEL, FT_PER_M } from "../analysis/cc_rules.js";
import { netColor } from "../cad/materials.js";
import { pairTree, pairState, treeShown, STATE_COLORS } from "../core/trees.js";
import { stateTree } from "./state_tree.js";
import { refine, pathNets } from "../pcba/board_iso.js";
import { BOARD_RULES, FUNCTIONAL_NOTE, boardScene, showBoard, subjectPicker, levelsSection, scopeSection, levelColor } from "./creepage_board.js";

const pairKey = (a, b) => [a, b].sort().join("|");
const GROUP_ORDER = ["I", "II", "IIIa", "IIIb"];

/** Nets of an assembly: those saved in asm.isolation, completed with the nets declared by the parts (elec.net, pcb.nets). */
export const collectNets = (asm) => netsOf(flatAsm(asm, (id) => store.assembly(id)) || asm, (id) => store.part(id));      // the nets of every part, through the sub-assemblies

/** Scene bodies (world meshes with roles) of a built assembly, with the overrides saved in the analysis. */
export function sceneOf(asm, ctx) {
  const ov = (asm.isolation || {}).overrides || {}, bodies = [], free = ((asm.isolation || {}).params || {}).cut_edge !== "counted";      // the cut edge of a laser-cut insulator is left out of the creepage, unless told otherwise
  for (const inst of ctx.asm.instances) {
    const b = ctx.built[inst.part];
    for (const body of b.bodies) {
      const id = `${inst.id}/${body.name}`, o = ov[id] || {};
      bodies.push({ ...sceneBody(id, `${store.part(inst.part).name || inst.part}${b.bodies.length > 1 ? ` · ${body.label || body.name}` : ""}`, body, { pos: body.mesh.pos, idx: body.mesh.idx }, ctx.sol.placements[inst.id], o), inst: inst.id, part: inst.part, bodyName: body.name });
      const last = bodies[bodies.length - 1]; last.cutEdge = free && last.kind === "insulator" && charredEdge(store.part(inst.part));
    }
  }
  return bodies;
}

/** Required distances and verdict of one pair, given the measured paths. */
export function judge(req, meas) {
  const out = { clrReq: req.clearance_mm, crpReq: null, group: null, clr: null, crp: null, clrOk: null, crpOk: null, ok: null };
  if (meas) {
    const c = meas.clearance || {}, k = meas.creepage || {};
    out.clr = c.d; out.clrCapped = !!c.capped;
    out.clrOk = req.clearance_mm === null ? null : c.d !== null && c.d !== undefined ? c.d >= req.clearance_mm - 1e-6 : c.capped ? true : null;
    if (k.none) { out.crpOk = true; out.crpNone = true; }
    else {
      out.group = k.printed ? "PCB" : (k.group || "IIIb");
      out.crpReq = req.creepage_mm[out.group] ?? req.creepage_mm.IIIb ?? null;
      out.crp = k.d; out.crpCapped = !!k.capped;
      out.crpOk = out.crpReq === null ? null : k.d !== null && k.d !== undefined ? k.d >= out.crpReq - 1e-6 : k.capped ? true : null;
    }
    out.ok = out.clrOk === false || out.crpOk === false ? false : out.clrOk === null && out.crpOk === null ? null : true;
  }
  return out;
}

function render(main, args) {
  /* what is analysed : an assembly (#/creepage/<id>) or one board alone (#/creepage/board/<id>) ; a project that only has boards opens on its first */
  const wantBoard = args[0] === "board", b0 = wantBoard ? store.board(args[1]) : null, a0 = !wantBoard && args[0] ? store.assembly(args[0]) : null;
  const onBoard = !!b0 || (!a0 && !store.assemblies.length && store.boards.length > 0), id = onBoard ? (b0 || store.boards[0]).id : a0 ? a0.id : (store.assemblies[0] && store.assemblies[0].id) || null;
  const left = el("aside", { class: "side" }), right = el("aside", { class: "side right" }), view = el("div");
  const root = el("div", { class: "studio" }, left, view, right);
  root.style.setProperty("--left-w", "320px"); root.style.setProperty("--right-w", "500px");
  main.append(root);
  if (!id) {
    root.classList.add("no-right"); right.remove();
    left.append(el("img", { class: "side-mark", src: "img/marks/creepage.svg", alt: "" }), el("div", { class: "side-head" }, el("h2", null, "Isolation")));
    view.append(el("div", { class: "page" }, el("div", { class: "empty" }, el("h2", null, "L'analyse part d'un assemblage ou d'une carte"), el("p", null, "Créez d'abord un assemblage — c'est sa géométrie complète qui est analysée — ou une carte dans le PCBA : son cuivre s'analyse seul."), el("a", { class: "btn btn-primary", href: "#/assembly" }, "Aller à Assemblage"), " ", el("a", { class: "btn", href: "#/pcba" }, "Aller au PCBA"))));
    return null;
  }
  const asm = () => (onBoard ? store.board(id) : store.assembly(id));      // the document analysed : the assembly, or the board
  const st = { ctx: null, bodies: null, results: null, sel: null, token: 0, running: false, ghost: true, worker: null, hidden: new Set(), fold: new Set(), show: {}, body: null, scene: onBoard ? boardScene(asm()) : null };      // hidden : bodies put aside to see behind them — still analysed
  /* on a board the potentials are its nets grouped by voltage, read from the PCBA ; its pairs start at Functional (two nets of one circuit) */
  const iso = () => ({ nets: onBoard ? st.scene.levels.map((l) => ({ name: l.name, kind: l.kind, voltage: l.voltage })) : collectNets(asm()), params: { ...DEFAULT_PARAMS, ...(onBoard ? { level: "functional" } : {}), ...((asm().isolation || {}).params || {}) }, levels: (asm().isolation || {}).levels || {}, overrides: (asm().isolation || {}).overrides || {} });
  const save = (fn, label) => (onBoard ? store.updateBoard(id, (b) => { b.isolation = b.isolation || {}; fn(b.isolation); }, label) : store.updateAssembly(id, (a) => { a.isolation = a.isolation || {}; a.isolation.nets = collectNets(a); fn(a.isolation); }, label));
  /* ---- hide and bring back, roles and potentials : with the mouse, on the body itself ---- */
  const ROLE_FR = { conductor: "conducteur", floating: "flottant", insulator: "isolant", ignore: "ignoré" }, LEVELS = [["3V3", 3.3], ["5V", 5], ["12V", 12], ["24V", 24], ["48V", 48], ["HV+", 400], ["HV-", 0], ["GND", 0]];
  const hide = (bid, on = true) => { if (on) st.hidden.add(bid); else st.hidden.delete(bid); vp.viewer.setVisible(bid, !on); renderLeft(); };
  const showAll = () => { for (const k of [...st.hidden]) vp.viewer.setVisible(k, true); st.hidden.clear(); renderLeft(); };
  const setRole = (b, kind) => save((x) => { x.overrides = x.overrides || {}; const q = { ...(x.overrides[b.id] || {}) }; if (kind) q.kind = kind; else delete q.kind; x.overrides[b.id] = q; }, `Rôle de ${b.name}`);
  const setNet = (b, net) => save((x) => { x.overrides = x.overrides || {}; x.overrides[b.id] = { ...(x.overrides[b.id] || {}), kind: "conductor", net }; }, `${b.name} : potentiel ${net}`);
  const addLevel = (name, voltage, then) => save((x) => { if (!x.nets.some((n) => n.name === name)) x.nets.push({ name, kind: "dc", voltage }); if (then) then(x); }, `Potentiel ${name} ajouté`);
  const bodyMenu = (h) => {
    const b = h && st.bodies ? st.bodies.find((q) => q.id === h.id) : null;
    if (!b) return st.hidden.size ? [{ label: `Ramener les ${st.hidden.size} corps masqué(s)`, keys: "Maj+H", icon: "eye", run: showAll }] : null;
    if (onBoard) return [{ title: `${b.name} — ${ROLE_FR[b.kind]}${b.net ? ` · ${b.net}` : ""}` }, { label: "Masquer ce corps", keys: "H", icon: "eye", run: () => hide(b.id) }, ...(st.hidden.size ? [{ label: `Ramener les ${st.hidden.size} corps masqué(s)`, keys: "Maj+H", icon: "eye", run: showAll }] : []), "—", { title: "Sur une carte, le rôle et la tension viennent du PCBA" }];
    const nets = iso().nets, missing = LEVELS.filter(([n]) => !nets.some((q) => q.name === n));
    return [{ title: `${b.name} — ${ROLE_FR[b.kind]}${b.net ? ` · ${b.net}` : ""}` }, { label: "Masquer ce corps", keys: "H", icon: "eye", run: () => hide(b.id) }, ...(st.hidden.size ? [{ label: `Ramener les ${st.hidden.size} corps masqué(s)`, keys: "Maj+H", icon: "eye", run: showAll }] : []),
      "—", { title: "Son rôle" }, ...Object.entries(ROLE_FR).map(([k, l]) => ({ label: `${l[0].toUpperCase()}${l.slice(1)}`, icon: k === "insulator" ? "layers" : k === "ignore" ? "cross" : "power", disabled: b.kind === k, run: () => setRole(b, k) })),
      "—", { title: "Son potentiel" }, ...nets.map((n) => ({ label: `${n.name} — ${fmt(n.voltage, 1)} V`, icon: "power", disabled: b.net === n.name, run: () => setNet(b, n.name) })),
      ...missing.slice(0, 5).map(([n, v]) => ({ label: `Nouveau potentiel ${n} (${String(v).replace(".", ",")} V)`, icon: "plus", run: () => addLevel(n, v, (x) => { x.overrides = x.overrides || {}; x.overrides[b.id] = { ...(x.overrides[b.id] || {}), kind: "conductor", net: n }; }) }))];
  };
  const hovered = () => { const h = vp.viewer.hoverHit; return h && st.bodies ? st.bodies.find((q) => q.id === h.id) : null; };
  const vp = createViewport(view, { name: () => `${id}_isolation`, explode: false, menuFor: (h) => bodyMenu(h), keys: [["H", "Masquer le corps survolé"], ["Maj + H", "Ramener tous les corps masqués"]],
    onKey: (e) => { const k = e.key.toLowerCase(); if (k === "h" && e.shiftKey) showAll(); else if (k === "h") { const b = hovered(); if (b) hide(b.id); else toast("Survolez un corps, puis H pour le masquer ; Maj + H les ramène tous.", "info", 3500); } } });
  const info = el("span", { class: "chip" }, "—");
  vp.setStatus(info);
  const bG = btn("Masse transparente", () => { st.ghost = !st.ghost; bG.classList.toggle("on", st.ghost); paint(); }, { small: true, icon: "layers", tip: "Isolants en transparence pour voir les conducteurs et les chemins" });
  bG.classList.add("on");
  vp.group(bG);
  const off = store.on("change", () => { if (!asm()) { go("#/creepage"); return; } renderLeft(); rebuild(); });
  renderLeft(); renderRight(); rebuild(true);

  async function rebuild(first) {
    const token = ++st.token;
    if (onBoard) {      // a board is built here, from its document : no kernel, nothing to wait for
      try {
        const scene = boardScene(asm()), bodies = scene.bodies, sum = (a) => { let t = 0; for (let i = 0; i < a.length; i++) t += a[i] * ((i % 7) + 1); return Math.round(t * 100); }, I0 = asm().isolation || {}, sig = JSON.stringify([bodies.map((b) => [b.id, b.kind, b.net, b.group, b.pos.length, sum(b.pos)]), scene.levels.map((l) => [l.name, l.kind]), I0.params || {}, I0.levels || {}]);      // a condition or a level that changes makes the verdicts stale too
        if (st.sig && st.sig !== sig) { st.results = null; }           // the copper, a voltage, the laminate or a condition changed: measurements are stale (the pair chosen stays)
        st.sig = sig; st.scene = scene; st.ctx = { board: true }; st.bodies = bodies; paint(); if (first) vp.viewer.view("top"); vp.setBusy("");
        info.textContent = `Carte seule : ${scene.levels.length} potentiel(s) · ${scene.levels.reduce((n, l) => n + l.nets.length, 0)} net(s) · ${new Set(bodies.filter((b) => b.kind === "floating").map((b) => b.id.split("@")[0])).size} pastille(s) sans net`; info.className = "chip";
        renderLeft(); renderRight();
      } catch (e) { vp.setBusy(""); info.textContent = e.message; info.className = "chip bad"; }
      return;
    }
    const stop = () => { st.token++; kernel.cancel(); setStatus("Construction annulée", ""); vp.setBusy("Construction annulée : l'assemblage n'est pas affiché.", { stopped: true, retry: () => rebuild(true) }); };
    vp.setBusy(st.ctx ? "" : "Construction de l'assemblage…", { cancel: stop });
    try {
      const ctx = await buildAssembly(asm(), (t, done, total) => vp.setBusy(st.ctx ? "" : t, { done, total, cancel: stop }));
      if (token !== st.token) return;
      const bodies = sceneOf(asm(), ctx), sig = JSON.stringify([bodies.map((b) => [b.id, b.kind, b.net, b.group, b.pos.length, b.cutEdge]), Object.values(ctx.sol.placements)]);
      if (st.sig && st.sig !== sig) { st.results = null; st.sel = null; }           // the geometry or the roles changed: measurements are stale
      st.sig = sig; st.ctx = ctx; st.bodies = bodies;
      paint();
      if (first) vp.viewer.view("iso");
      vp.setBusy("");
      const nc = bodies.filter((b) => b.kind === "conductor").length, ni = bodies.filter((b) => b.kind === "insulator").length, nf = bodies.filter((b) => b.kind === "floating").length;
      info.textContent = `${bodies.length} corps : ${nc} conducteur(s) avec net · ${nf} flottant(s) · ${ni} isolant(s)`;
      renderLeft(); renderRight();
    } catch (e) { if (token === st.token) { vp.setBusy(""); info.textContent = e.message; info.className = "chip bad"; } }
  }
  function paint() {
    if (!st.ctx) return;
    const role = new Map(st.bodies.map((b) => [b.id, b]));
    if (onBoard) showBoard(vp.viewer, st.scene, (b) => (b.kind === "conductor" ? levelColor(st.scene, b.net) : b.color));
    else showAssembly(vp.viewer, st.ctx, { skipHidden: false, colorOf: (inst, body) => { const r = role.get(`${inst.id}/${body.name}`); return r.kind === "conductor" ? cssColor(netColor(r.net)) : r.kind === "floating" ? "#c9a94f" : null; } });
    for (const b of st.bodies) { vp.viewer.setOpacity(b.id, b.kind === "insulator" && st.ghost ? 0.22 : b.kind === "ignore" ? 0.1 : 1); if (st.hidden.has(b.id)) vp.viewer.setVisible(b.id, false); }
    drawPaths();
  }
  function drawPaths() {
    const v = vp.viewer;
    v.clearOverlays("path");
    if (!st.results) return;
    const shown = st.sel ? st.results.filter((r) => pairKey(r.a, r.b) === st.sel) : st.results.filter((r) => treeShown(st.show, pairState(r)));      // the selected pair, or every state whose eye is open — what fails, by default
    for (const r of shown) {
      const c = r.clearance, k = r.creepage, state = pairState(r), tone = state === "fail" ? "#ff3b30" : STATE_COLORS[state];      // a path takes the colour of the state of its pair
      if (c && c.path && c.path.length > 1) { v.addPath(c.path, tone, "path", onBoard ? 0.12 : 1.2); v.addLabel(mid(c.path), `clearance [clr] ${fmt(c.d, 2)} mm`, "path", "path"); }
      if (k && k.path && k.path.length > 1) { v.addPath(k.path, tone, "path", onBoard ? 0.1 : 1.0, !onBoard); v.addLabel(mid(k.path, 0.35), `creepage [crp] ${fmt(k.d, 2)} mm`, "path", "path"); }
    }
  }
  /* on a board a path is a few tenths of a millimetre long : choosing its pair brings the view on it (« cadrer » of the toolbar goes back to the whole) */
  const focusPair = (key) => { const r = onBoard && key && st.results ? st.results.find((x) => pairKey(x.a, x.b) === key) : null, path = r && ((r.creepage && r.creepage.path && r.creepage.path.length > 1 && r.creepage.path) || (r.clearance && r.clearance.path)); if (path && path.length > 1) vp.viewer.focus(mid(path), Math.max(6, 14 * (r.verdict.crp || r.verdict.clr || 1))); };
  const mid = (path, t = 0.5) => { let L = 0; const seg = []; for (let i = 0; i + 1 < path.length; i++) { const d = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1], path[i + 1][2] - path[i][2]); seg.push(d); L += d; } let s = L * t; for (let i = 0; i < seg.length; i++) { if (s <= seg[i]) { const q = seg[i] ? s / seg[i] : 0; return [0, 1, 2].map((k) => path[i][k] + (path[i + 1][k] - path[i][k]) * q); } s -= seg[i]; } return path[path.length - 1]; };

  function pairs() {
    const I = iso(), used = new Set(st.bodies ? st.bodies.filter((b) => b.kind === "conductor").map((b) => b.net) : []), nets = I.nets.filter((n) => used.has(n.name)), out = [];
    const fv = I.params.floating_v || floatingSpan(nets);
    for (let i = 0; i < nets.length; i++) for (let j = i + 1; j < nets.length; j++) {
      const level = I.levels[pairKey(nets[i].name, nets[j].name)] || I.params.level || "basic", inCircuit = onBoard && level === "functional";
      const req = requirement(inCircuit ? BOARD_RULES : BUILTIN, { ...I.params, floating_v: fv }, nets[i], nets[j], level);
      if (inCircuit && req.u_rms > 0) { req.steps.push(FUNCTIONAL_NOTE); req.tests = null; }      // on a board, two nets of one circuit : no dielectric test between them
      out.push({ a: nets[i].name, b: nets[j].name, level, req });
    }
    return out;
  }
  function analyse() {
    if (st.running || !st.bodies) return;
    const ps = pairs().filter((p) => p.req.u_rms > 0);
    if (!ps.length) { toast(onBoard ? "Aucune paire à analyser : il faut au moins deux potentiels de tensions différentes — les tensions se donnent dans le PCBA." : "Aucune paire de nets à analyser : donnez un net à au moins deux conducteurs de potentiels différents.", "warn", 6000); return; }
    st.running = true; st.results = null; st.sel = null; renderRight();
    const w = new Worker(new URL("../analysis/cc_worker.js", import.meta.url), { type: "module" });
    st.worker = w;
    const t0 = performance.now(), halt = () => { w.terminate(); st.worker = null; st.running = false; vp.setBusy(""); setStatus("Analyse d'isolation annulée", ""); toast("Analyse annulée : aucun résultat n'a été gardé.", "info"); renderRight(); };
    w.onmessage = (e) => {
      const m = e.data;
      if (m.progress) { vp.setBusy(`Mesure des chemins ${m.progress.done + 1} / ${m.progress.total} : ${m.progress.pair}`, { done: m.progress.done, total: m.progress.total, cancel: halt }); return; }
      w.terminate(); st.worker = null; st.running = false; vp.setBusy("");
      if (!m.ok) { toast(`Analyse interrompue : ${m.error}`, "error", 8000); renderRight(); return; }
      st.results = m.results.map((r0) => { const p = ps.find((x) => x.a === r0.a && x.b === r0.b), r = onBoard ? refine(st.scene, r0, r0.a, r0.b) : r0, far = r.creepage && r.creepage.path && r.creepage.path.length > 1 ? r.creepage.path : (r.clearance || {}).path;
        return { ...r, req: p.req, level: p.level, verdict: judge(p.req, r), who: onBoard ? pathNets(st.scene, far, r.a, r.b) : null }; });      // on a board : exact where the path is straight, and the two nets it joins
      const bad = st.results.filter((r) => r.verdict.ok === false).length;
      setStatus(`Isolation : ${bad ? `${bad} paire(s) en défaut` : "toutes les paires passent"}`, bad ? "bad" : "done");
      toast(`Analyse terminée en ${fmt((performance.now() - t0) / 1000, 1)} s : ${bad ? `${bad} paire(s) en défaut` : "aucun défaut"}.`, bad ? "warn" : "success", 6000);
      // keep a light summary in the project for the report
      save((x) => { x.results = st.results.map((r) => ({ a: r.a, b: r.b, level: r.level, u: r.req.u_rms, clrReq: r.verdict.clrReq, clr: r.verdict.clr, crpReq: r.verdict.crpReq, crp: r.verdict.crp, group: r.verdict.group, ok: r.verdict.ok, ...(r.who ? { nets: [r.who.a, r.who.b] } : {}), when: new Date().toISOString() })); }, `${id} : analyse d'isolation`);
      drawPaths(); renderRight();
    };
    w.onerror = (e) => { w.terminate(); st.running = false; vp.setBusy(""); toast(`Le moteur de chemins n'a pas démarré : ${e.message || "erreur de chargement"}.`, "error", 8000); renderRight(); };
    const I = iso();
    w.postMessage({ id: 1, bodies: st.bodies.map((b) => ({ id: b.id, name: b.name, kind: b.kind, net: b.net, group: b.group, printed: b.printed, cutEdge: !!b.cutEdge, pos: b.pos, idx: b.idx })),
      pairs: ps.map((p) => ({ a: p.a, b: p.b, x: p.req.x_mm ?? 1, maxClearance: Math.max(onBoard ? 12 : 40, (p.req.clearance_mm || 5) * 8), maxCreepage: Math.max(onBoard ? 12 : 60, (Math.max(...Object.values(p.req.creepage_mm).filter((v) => v)) || 8) * 8) })), opts: {} });      // on a board, nothing farther than 12 mm is of interest : the search stops there
    vp.setBusy("Préparation de la scène…", { cancel: halt });
  }

  /* ---------- left: nets, conditions, roles ---------- */
  function renderLeft() {
    clear(left);
    const I = iso(), P = I.params;
    setGuide([...isolationGuide(asm(), I.nets, { here: true }).filter((x) => onBoard || x.field === "nets"), ...(onBoard ? st.scene.notes.filter((n) => n.warn).map((n) => ({ level: "warn", text: `${id} — isolation : ${n.text}` })) : [])].map((x) => ({ ...x, si: true })));      // the guide of the project says the rest (core/guide_checks.js) ; an assembly without potentials is worth a word here only — a board says all of its own
    left.append(el("img", { class: "side-mark", src: "img/marks/creepage.svg", alt: "" }), el("div", { class: "side-head" }, el("h2", null, "Isolation")));
    const scroll = el("div", { class: "side-scroll" });
    left.append(scroll);
    scroll.append(field("Ce que l'on analyse", subjectPicker(onBoard ? "board" : "asm", id), onBoard ? "Une carte seule : son cuivre réel, sans le reste du produit." : store.boards.length ? "Le produit monté. Une carte s'analyse aussi seule : elle est dans ce menu." : null));
    if (onBoard) scroll.append(levelsSection(st.scene, asm(), save));
    const netSec = el("div", { class: "side-section" }, el("h3", null, el("span", { class: "grow" }, "Potentiels (nets)"), btn("", () => save((x) => { x.nets.push({ name: `NET${x.nets.length + 1}`, kind: "dc", voltage: 0 }); }, "Net ajouté"), { small: true, icon: "plus", tip: "Ajouter un potentiel sans nom" })));
    const lack = LEVELS.filter(([n]) => !I.nets.some((q) => q.name === n));
    if (lack.length) netSec.append(el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap", gap: ".25rem", margin: "0 0 .4rem" } }, el("small", { class: "muted", style: { width: "100%" } }, "Un même assemblage porte souvent plusieurs potentiels (logique, capteurs, puissance) — ajoutez les vôtres :"),
      lack.map(([n, v]) => btn(n, () => addLevel(n, v), { small: true, tip: `Ajouter le potentiel ${n} à ${String(v).replace(".", ",")} V (la tension se corrige ensuite)` }))));
    for (const n of I.nets) {
      const upd = (key, val) => save((x) => { const q = x.nets.find((k) => k.name === n.name); q[key] = val; }, `Net ${n.name} : ${key}`);
      netSec.append(el("div", { class: "param", style: { gridTemplateColumns: "auto minmax(0,1fr) 78px auto" } }, el("span", { class: "swatch", style: { background: cssColor(netColor(n.name)) } }), el("label", null, n.name, el("small", null, n.kind === "ac" ? "V RMS" : "V DC")),
        el("input", { type: "number", value: n.voltage, step: "any", "aria-label": `Tension de ${n.name}`, onChange: (e) => upd("voltage", parseFloat(e.target.value) || 0) }),
        el("label", { class: "check", "data-tip": "Système HV flottant (IT) : après un premier défaut d'isolement, ce net peut se trouver à la tension du système par rapport au Chassis" }, el("input", { type: "checkbox", checked: !!n.floating, onChange: (e) => upd("floating", e.target.checked) }), "IT")));
    }
    if (!onBoard) scroll.append(netSec);
    const num = (key, label, step, hint) => field(label, el("input", { type: "number", value: P[key] ?? "", step, onChange: (e) => save((x) => { x.params = { ...(x.params || {}), [key]: e.target.value === "" ? null : parseFloat(e.target.value) }; }, `Isolation : ${label}`) }), hint);
    const sel = (key, label, opts, hint) => field(label, el("select", { onChange: (e) => save((x) => { x.params = { ...(x.params || {}), [key]: /^\d+$/.test(e.target.value) ? +e.target.value : e.target.value }; }, `Isolation : ${label}`) }, opts.map(([v, l]) => el("option", { value: v, selected: String(P[key]) === String(v) }, l))), hint);
    scroll.append(el("div", { class: "side-section" }, el("h3", null, "Conditions de l'analyse"),
      el("div", { class: "form-row" }, sel("pollution_degree", "Pollution degree", [[1, "PD1 — sous revêtement"], [2, "PD2 — boîtier propre et sec"], [3, "PD3 — condensation attendue"]]), sel("ovc", "Overvoltage category", [["I", "OVC I"], ["II", "OVC II"], ["III", "OVC III"], ["IV", "OVC IV"]])),
      el("div", { class: "form-row" }, num("altitude_m", "Altitude (m)", "100", `${fmt((P.altitude_m || 0) * FT_PER_M, 0)} ft`), sel("field", "Champ", [["A", "Cas A — inhomogène"], ["B", "Cas B — homogène"]])),
      el("div", { class: "form-row" }, sel("level", "Isolation par défaut", [["functional", "Functional"], ["basic", "Basic"], ["reinforced", "Reinforced"]]), num("voltage_factor", "Facteur maison k", "0.5", "Tables lues à k × U")),
      onBoard ? el("p", { class: "muted", "data-iso-level-note": "", style: { fontSize: ".78rem" } }, "Sur une carte seule, le niveau de départ est Functional : entre deux nets d'un même circuit, l'isolation ne protège personne. La paire qui sépare deux circuits (puissance ↔ commande) se monte à Basic ou à Reinforced, d'un clic sur elle à droite.") : null,
      !onBoard && st.bodies && st.bodies.some((b) => b.kind === "insulator" && charredEdge(store.part(b.part))) ? sel("cut_edge", "Chant d'un isolant découpé au laser", [["free", "Hors de la ligne de fuite (prudent)"], ["counted", "Compté comme une surface"]], "Un bord découpé au laser peut être carbonisé : par prudence, le chemin le longe sans rien compter. Tenue réelle à vérifier par essai.") : null,
      el("p", { class: "muted", style: { fontSize: ".78rem" } }, "Règles : IEC 60664-1 (tables intégrées, à vérifier contre votre copie de la norme avant toute décision de certification). ", el("a", { href: "#/help/sources/isolation" }, "Sources de la méthode →"))));
    if (st.bodies) {
      const sec = el("div", { class: "side-section" }, el("h3", null, el("span", { class: "grow" }, onBoard ? "Cuivre de la carte" : "Rôle des corps"), st.hidden.size ? btn(`Ramener (${st.hidden.size})`, showAll, { small: true, icon: "eye", tip: "Ramener tous les corps masqués (Maj + H)" }) : null),
        el("p", { class: "muted", style: { fontSize: ".78rem", margin: "0 0 .3rem" } }, onBoard ? "Un net par ligne, sous son potentiel : un clic le montre dans la vue ; l'œil le masque. Un corps masqué reste analysé." : "Cliquez un corps pour lui donner son rôle et son potentiel ; clic droit dans la vue : le masquer. Un corps masqué reste analysé."));
      /* grouped by what a body is for the analysis, each group in its colour : conductors by potential, then the rest */
      for (const g0 of bodyGroups(st.bodies, I.nets)) { const g = onBoard && g0.net ? { ...g0, color: levelColor(st.scene, g0.net) } : g0;
        const shut = st.fold.has(g.key), hiddenIn = g.bodies.filter((b) => st.hidden.has(b.id)).length;
        const dot = el("span", { class: "swatch", "aria-hidden": "true", style: { background: cssColor(g.color) } });
        sec.append(el("button", { class: "cc-group", type: "button", "aria-expanded": shut ? "false" : "true", "data-tip": g.hint, onClick: () => { if (shut) st.fold.delete(g.key); else st.fold.add(g.key); renderLeft(); } },
          dot, el("b", { class: "grow" }, g.title), el("small", null, `${g.bodies.length}${hiddenIn ? ` · ${hiddenIn} masqué${hiddenIn > 1 ? "s" : ""}` : ""}`), el("span", { class: "cc-chev", "aria-hidden": "true" }, shut ? "▸" : "▾")));
        if (shut) continue;
        for (const b of g.bodies) {
          /* a body is a line of the tree : its name, what it is ; a click opens ITS editor — one at a time, not a wall of menus */
          const o = I.overrides[b.id] || {}, off = st.hidden.has(b.id), sel = st.body === b.id, pick = () => { st.body = sel ? null : b.id; if (onBoard) vp.viewer.highlight(st.body ? [st.body] : []); renderLeft(); }, WORD = { conductor: "conducteur", floating: "flottant", insulator: "isolant", ignore: "ignoré" };
          const row = el("div", { class: "cc-body" + (off ? " off" : "") + (sel ? " sel" : ""), role: "treeitem", "aria-selected": sel ? "true" : "false", tabindex: "0", "data-body-row": b.id,
            onClick: (e) => { if (!e.target.closest("button")) pick(); }, onKeydown: (e) => { if ((e.key === "Enter" || e.key === " ") && !e.target.closest("button")) { e.preventDefault(); pick(); } } },
            el("button", { class: "icon-btn", type: "button", "aria-label": off ? `Ramener ${b.name}` : `Masquer ${b.name}`, "aria-pressed": off ? "true" : "false", "data-tip": off ? "Masqué — cliquez pour le ramener" : "Masquer ce corps", onClick: () => hide(b.id, !off) }, icon(off ? "cross" : "eye")),
            el("span", { class: "cc-name", "data-tip": `${b.id} · ${b.material}${b.group ? ` · group ${b.group}` : ""}${off ? " · masqué" : ""}` }, b.name),
            el("small", { class: "cc-role" }, onBoard ? WORD[b.kind] : `${WORD[b.kind]}${o.kind ? "" : " (auto)"}${b.net && b.kind !== "insulator" && b.kind !== "ignore" ? ` · ${b.net}` : ""}`));
          const editor = !sel || onBoard ? null : el("div", { class: "bc-edit", "data-body-edit": b.id }, el("div", { class: "bc-row" }, el("small", null, "Rôle"),
            el("select", { "aria-label": `Rôle de ${b.name}`, onChange: (e) => save((x) => { x.overrides = x.overrides || {}; const q = { ...(x.overrides[b.id] || {}) }; if (e.target.value) q.kind = e.target.value; else delete q.kind; x.overrides[b.id] = q; }, `Rôle de ${b.name}`) },
              [["", `auto (${WORD[b.kind]})`], ["conductor", "conducteur"], ["floating", "flottant"], ["insulator", "isolant"], ["ignore", "ignoré"]].map(([v, l]) => el("option", { value: v, selected: (o.kind || "") === v }, l)))),
            b.kind === "insulator" || b.kind === "ignore" ? null : el("div", { class: "bc-row" }, el("small", null, "Potentiel"), el("select", { "aria-label": `Net de ${b.name}`, onChange: (e) => save((x) => { x.overrides = x.overrides || {}; x.overrides[b.id] = { ...(x.overrides[b.id] || {}), net: e.target.value || null }; }, `Net de ${b.name}`) },
              el("option", { value: "" }, "—"), I.nets.map((n) => el("option", { value: n.name, selected: b.net === n.name }, n.name)))));
          row.style.borderLeftColor = cssColor(g.color); sec.append(row); if (editor) { editor.style.borderLeftColor = cssColor(g.color); sec.append(editor); }
        }
      }
      scroll.append(sec);
    }
    if (onBoard) scroll.append(scopeSection(st.scene));
  }

  /* ---------- right: pairs ---------- */
  function renderRight() {
    clear(right);
    right.append(el("div", { class: "side-head" }, el("h2", null, onBoard ? "Paires de potentiels" : "Paires de nets"), btn(st.running ? "Analyse…" : "Analyser", () => analyse(), { primary: true, small: true, icon: "play", disabled: st.running || !st.bodies, tip: onBoard ? "Mesure clearance et creepage de chaque paire de potentiels sur le cuivre de la carte" : "Mesure clearance et creepage de chaque paire sur l'assemblage complet" })));
    const body = el("div", { class: "side-scroll" });
    right.append(body);
    if (!st.bodies) { body.append(el("p", { class: "muted" }, "Construction…")); return; }
    const ps = pairs();
    if (!ps.length) { body.append(el("div", { class: "card", "data-iso-none": onBoard ? "board" : "asm" }, el("p", null, onBoard ? "Aucune paire de potentiels." : "Aucune paire de nets."), el("p", { class: "muted" }, onBoard ? "Il faut au moins deux potentiels : donnez leur tension aux nets d'alimentation dans le PCBA." : "Donnez un net aux conducteurs (colonne « Rôle des corps », ou « Rôle électrique » dans la fiche de chaque pièce, ou les zones d'un PCB)."),
      !onBoard && store.boards.length ? el("p", { class: "muted" }, "Le cuivre d'une carte ne se voit pas dans l'assemblage : pour l'isolation d'un PCBA, choisissez la carte dans « Ce que l'on analyse ». ", el("a", { href: `#/creepage/board/${encodeURIComponent(store.boards[0].id)}` }, `Analyser « ${store.boards[0].name || store.boards[0].id} » →`)) : null)); return; }
    const res = new Map((st.results || []).map((r) => [pairKey(r.a, r.b), r]));
    /* the pairs as a tree, by verdict : what fails first ; the eye of a state draws the paths of its pairs in the view */
    body.append(stateTree({ label: onBoard ? "Paires de potentiels, par état" : "Paires de nets, par état", tree: pairTree(ps, st.results, { key: pairKey, fmt, levels: LEVEL_LABEL }), sel: st.sel, attr: "data-pair-row", keep: st.results ? ["fail"] : [], eye: "Chemins tracés dans la vue",
      shown: st.results ? (k) => (k === "todo" ? null : treeShown(st.show, k)) : null, toggle: (k, on) => { st.show = { ...st.show, [k]: on }; drawPaths(); renderRight(); }, select: (key) => { st.sel = key; drawPaths(); focusPair(key); renderRight(); } }),
      el("p", { class: "muted", style: { fontSize: ".76rem", margin: ".4rem 0" } }, "Distances en mm : mesurée / requise. Le creepage requis est celui du pire groupe de matière touché par le chemin. Cliquez une paire pour voir ses chemins et son calcul ; l'œil d'un état trace les chemins de toutes ses paires."));
    const selP = ps.find((p) => pairKey(p.a, p.b) === st.sel);
    if (selP) {
      const r = res.get(st.sel), lvl = el("select", { onChange: (e) => save((x) => { x.levels = { ...(x.levels || {}), [st.sel]: e.target.value }; }, `Niveau ${selP.a} ↔ ${selP.b}`) }, ["functional", "basic", "reinforced"].map((k) => el("option", { value: k, selected: selP.level === k }, LEVEL_LABEL[k])));
      body.append(el("div", { class: "card", style: { marginTop: ".6rem" } }, el("h3", null, `${selP.a} ↔ ${selP.b}`), field("Niveau d'isolation de la paire", lvl),
        r && r.error && el("p", { class: "form-error" }, r.error),
        r && r.who && (r.who.a || r.who.b) && el("p", { "data-iso-who": "", style: { fontSize: ".86rem" } }, "Au plus court : ", el("b", null, `${r.who.a || "?"} ↔ ${r.who.b || "?"}`), r.who.layer === "both" ? ", d'une face à l'autre de la carte." : `, couche du ${r.who.layer === "top" ? "dessus" : "dessous"}.`, r.creepage && r.creepage.exact ? " Chemin droit : distance exacte entre les deux cuivres." : ""),
        r && r.verdict && el("p", { style: { fontSize: ".86rem" } }, r.verdict.crpNone ? "Creepage : aucune surface isolante ne relie les deux nets. " : `Creepage sur ${r.verdict.group === "PCB" ? "circuit imprimé" : `material group ${r.verdict.group}`}${r.creepage && r.creepage.bridges ? `, ${r.creepage.bridges} rainure(s) pontée(s) (X = ${fmt(selP.req.x_mm, 2)} mm)` : ""}.${cutNote(r, st.bodies)} `,
          r.clearance && r.clearance.via && r.clearance.via.length ? `Clearance à travers ${r.clearance.via.length} conducteur(s) flottant(s) (d1 + d2). ` : "", r.clearance && r.clearance.direct === false ? "Le chemin dans l'air contourne un obstacle." : ""),
        el("h3", { style: { marginTop: ".5rem" } }, "Calcul des distances requises"), el("ol", { style: { margin: "0 0 .5rem", paddingLeft: "1.1rem", fontSize: ".82rem" } }, selP.req.steps.map((s) => el("li", null, s))),
        selP.req.warnings.map((w) => el("p", { class: "form-error", style: { fontSize: ".82rem" } }, w)),
        selP.req.tests && el("p", { class: "muted", style: { fontSize: ".8rem" } }, `Essais après assemblage : diélectrique ${fmt(selP.req.tests.hipot_rms, 0)} V rms ${selP.req.tests.duration_s} s (production ${fmt(selP.req.tests.production_rms, 0)} V ${selP.req.tests.production_s} s, équivalent DC ${fmt(selP.req.tests.dc_equivalent, 0)} V) · isolement ≥ ${fmt(selP.req.tests.ir_min_ohm_dc / 1000, 0)} kΩ · décharges partielles ${fmt(selP.req.tests.pd_initial, 0)} puis ${fmt(selP.req.tests.pd_extinction, 0)} V, ≤ ${selP.req.tests.pd_max_pc} pC.`)));
    } else if (st.results) body.append(el("p", { class: "muted", style: { fontSize: ".84rem" } }, st.results.some((r) => r.verdict.ok === false) ? "Les chemins en défaut sont tracés en rouge dans la vue. Corrigez la géométrie (écart, nervure, rainure plus large que X) dans la pièce concernée, puis relancez l'analyse." : "Toutes les paires respectent les distances requises."));
  }
  return () => { off(); st.token++; if (st.worker) st.worker.terminate(); vp.dispose(); setGuide([]); };
}
/** What to say when the creepage path of a pair takes the cut edge of a laser-cut insulator. */
function cutNote(r, bodies) {
  const ids = (r && r.creepage && r.creepage.cutEdges) || []; if (!ids.length) return "";
  const names = ids.map((id) => { const b = (bodies || []).find((x) => x.id === id); return `« ${b ? b.name : id} »`; });
  return ` Le chemin longe le chant découpé au laser de ${names.join(", ")} : ce trajet compte pour 0 mm (réglage « Chant d'un isolant découpé au laser »).`;
}
function cssColor(c) {
  if (!c.startsWith("hsl")) return c;
  const m = /hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/.exec(c);
  if (!m) return "#888888";
  const h = +m[1] / 360, s = +m[2] / 100, l = +m[3] / 100, q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return "#" + [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
}

registerModule({ key: "creepage", label: "Isolation", icon: "creepage", tip: "Creepage & Clearance — une carte seule ou l'assemblage complet (IEC 60664-1) : distances requises, chemins mesurés, verdict", render });
