/* DynamiteOrbit.ai — Logiciel : the software of an embedded BMS, drawn as objects one links, and written by the tool (demande de JP :
   « une approche de design logiciel via des objets visuels adaptés qui se codent tout seuls en librairie, module et structure de
   fichiers pour un CPU de BMS embarqué, sachant les in/out à gérer, leurs plages et le CPU choisi »).
   A GROUP OF ITS OWN, in the order of the V (demande de JP, 21 novembre 2026 : « sortir et bonifier la suite d'outils logiciel de l'onglet
   électronique… la même suite d'outils et de genre d'outils que pour la mécanique et l'électronique » ; choix cliqué : « Cycle en V ») :
   1 Exigences (modules/sw_req.js), 2 Architecture, 3 Conception, 4 Simulation, 5 Code, 6 Vérification (modules/sw_verify.js), 7 Livraison.
   This file draws five of them — each a screen of the top bar, the V drawn above (modules/sw_vband.js) — and their pages : the CPU (2),
   the tiles and the values (3), the live bench and the start-up (4), the files of the code (5), the loading (7). The address keeps the page
   (#/sw/values, #/swsim/start…) ; an address of before the V (#/sw/live) leads to its step.
   The same three places as every studio. Left, what one gives and where one is : the card of the step, what the page lists (the CPUs and the
   reference, the tiles to put, the values to read again, the files of the package, the journal of the live run, the list of delivery) and
   what the guide asks. Centre, what one looks at : the tiles and their wires, or a page one reads. Right, what one sets : the sheet of the
   object chosen — what enters, what leaves, its values — or, live, the bench.
   Every change is one step of the store : Ctrl + Z takes it back. The tool calls no assistant : the round trip is a text one copies. */

import { el, clear, icon, btn, toast, download, copyText } from "../core/dom.js";
import { store } from "../core/store.js";
import { registerModule, setGuide, setStatus } from "../core/app.js";
import { guideBox, nudge } from "../core/guide.js";
import { zip } from "../core/zip.js";
import { KINDS, NATURES } from "../sw/sw_objects.js";
import { demoDesign, problems, unsure, ready, simulate, events, wireCheck, order, split } from "../sw/sw_design.js";
import { vPackage } from "../sw/sw_docs.js";
import { cpuOf, cpuList } from "../sw/sw_cpu.js";
import { stepStates, rankOf, vstepOf, vOfPage } from "../sw/sw_steps.js";
import { runAll } from "../sw/sw_test.js";
import { STANDARDS, stdOf, levelOf, stdAsks } from "../sw/sw_std.js";
import { vBand, stepCard, swShell, vHash } from "./sw_vband.js";
import { releaseList } from "./sw_release.js";
import { docsSection } from "./sw_docs_ui.js";
import { swCanvas } from "./sw_canvas.js";
import { swBench } from "./sw_bench.js";
import { sheet, aiText, reimport } from "./sw_sheet.js";
import { cpuPage, startPage, codePage, loadPage } from "./sw_pages.js";
import { hwTag, hwProblems, flowLayout, snapAt, docked, hostBoard } from "../sw/sw_blocks.js";
import { openHil } from "./sw_hil_ui.js";
import { libraryPalette, reqImportSection, openImport } from "./sw_lib_ui.js";
import { swRack } from "./sw_lab.js";
import { shows, noviceOffers } from "../sw/sw_levels.js";
import { level } from "./sw_level_ui.js";
import { VIEW, autoPlace } from "../sw/sw_blocks.js";
import { DEVICES, devicePlacement } from "../sw/sw_devices.js";

const FOLDERS = { lib: ["#0891b2", "un module par genre de tuile"], cfg: ["#7c3aed", "une table de réglages par tuile posée"], io: ["#64748b", "le nom de chaque broche"], app: ["#16a34a", "le pas du logiciel"], hal: ["#b45309", "ce qui touche le CPU"], test: ["#dc2626", "le scénario rejoué sur un ordinateur"], doc: ["#475569", "traçabilité et chargement"] };
const LEVEL = { error: "error", todo: "todo", check: "warn" }, CANVAS = new Set(["objects", "values", "live"]), RIGHT = CANVAS;
const tile = (o) => el("button", { class: `cf-tile${o.sel ? " sel" : ""}`, type: "button", "aria-pressed": o.sel === undefined ? null : o.sel ? "true" : "false", "data-tip": o.tip || null, style: `--dom:${o.color}`, onClick: o.run, ...o.data }, o.pic, el("b", null, o.label), o.small ? el("small", null, o.small) : null);
const fr = (n) => (n === null || n === undefined ? "" : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ").replace("-", "−"));

function render(main, args, vkey) {
  clear(main);
  const lv = level(); VIEW.tags = shows(lv, "blockTags"); VIEW.chips = shows(lv, "blockChips");      // the level of the person : what a block shows (sw/sw_levels.js)
  const V = vstepOf(vkey), elsewhere = args[0] && !V.pages.includes(args[0]) && vOfPage(args[0]);
  if (elsewhere) { location.replace(vHash(elsewhere.key, args[0])); return () => {}; }      // an address of before the V : its step
  const { head, left, view, right, studio: root } = swShell(main, "sw-view");
  const design = () => (store.project && (store.project.software || [])[0]) || null;
  const firstPage = () => { const d = design(); if (V.key !== "design" || !d) return V.pages[0]; const S = stepStates(d, cpuOf(d)); return S.objects.state === "done" && S.values.state === "todo" ? "values" : "objects"; };
  const st = { step: V.pages.includes(args[0]) ? args[0] : firstPage(), sel: null, k: 0, file: "bms/README.md", alive: true, pack: "all" };
  const change = (label, fn) => store.commit(label, (p) => { p.software = p.software || []; if (!p.software[0]) return; fn(p.software[0]); });
  const host = el("div", { class: "sw-host" }), pageHost = el("div", { class: "sw-pagehost" }), replay = el("div", { class: "lab-bar sw-bar" }), liveBox = el("div", { class: "sw-livebox swlab bottom-pane", "data-bottom": "sw" }), rackHost = el("div", { class: "swlab-rackhost", hidden: true }), liveHost = el("div", { class: "sw-livehost" }), empty = el("div", { class: "page", hidden: true });
  liveBox.append(liveHost); view.append(empty, pageHost, rackHost, host, liveBox, replay);      // the panel of the bottom : its height is dragged at its top edge (core/panes.js mountBottom)
  const canvas = swCanvas(host, { rank: rankOf, showRank: shows(lv, "rank"), tag: (o) => hwTag(store.project, design(), o),
    onArrange: () => { const d = design(); if (!d) return; const pos = flowLayout(d); change("Logiciel : blocs rangés de gauche à droite", (x) => { for (const o of x.objects) if (pos[o.id]) Object.assign(o, pos[o.id]); }); setTimeout(() => canvas.fit(), 0); },
    onPick: (s) => { st.sel = s; paint(); renderRight(); },
    onMove: (id, x, y) => { const d0 = design(), was = (d0.wires || []).filter((w) => (split(w.from)[0] === id || split(w.to)[0] === id) && docked(d0, w)), sn = snapAt(d0, id, x, y), at = sn || { x, y };      // keyed blocks (sw/sw_blocks.js snapAt)
      const gone = was.filter((w) => !docked({ ...d0, objects: d0.objects.map((q) => (q.id === id ? { ...q, x: at.x, y: at.y } : q)) }, w));
      change(sn ? `Logiciel : ${id} emboîté` : gone.length ? `Logiciel : ${id} déboîté` : `Logiciel : ${id} déplacé`, (d) => { const o = d.objects.find((q) => q.id === id); if (!o) return; o.x = at.x; o.y = at.y;
        d.wires = d.wires.filter((w) => !gone.some((g) => g.from === w.from && g.to === w.to)); if (sn) d.wires.push(...sn.wires); });
      if (sn) toast(`Emboîté : ${sn.wires.length} liaison${sn.wires.length > 1 ? "s" : ""} faite${sn.wires.length > 1 ? "s" : ""} par les clés (${sn.wires.map((w) => `${split(w.from)[1]} → ${split(w.to)[1]}`).join(", ")}). Ctrl + Z pour revenir.`, "success", 4000);
      else if (gone.length) toast(`Déboîté : ${gone.length} liaison${gone.length > 1 ? "s" : ""} défaite${gone.length > 1 ? "s" : ""}. Ctrl + Z pour revenir.`, "info", 4000); },
    onWire: (from, to) => { const d = design(), c = wireCheck(d, from, to); if (!c.ok) { toast(c.text, "error", 7000); paint(); return; }
      const loops = order({ ...d, wires: [...d.wires.filter((w) => w.to !== to), { from, to }] }).loop.length > 0;
      change(`Logiciel : fil ${from} → ${to}`, (x) => { x.wires = x.wires.filter((w) => w.to !== to); x.wires.push({ from, to, ...(loops ? { delay: true } : {}) }); });
      toast(loops ? "Ce fil ferme une boucle : il porte la valeur du pas d'avant, comme le font les schémas-blocs. Un clic sur le fil pour le voir." : c.level ? c.text : "Fil posé.", loops || c.level ? "info" : "success", loops || c.level ? 7000 : 2200); } });
  let R = null, bench = null, journalHost = null, run = null, rack = null;
  const files = () => { const d = design(); return d ? vPackage(d, cpuOf(d)) : []; };      // the C, and the requirements and the verification beside it (doc/)
  const valuesAt = () => (R ? Object.fromEntries(Object.entries(R.ports).map(([r, y]) => [r, y[Math.min(st.k, y.length - 1)]])) : null);
  const guide = () => { const d = design(); return d ? [...problems(d, cpuOf(d)), ...hwProblems(store.project, d)].map((p) => ({ level: LEVEL[p.level] || "tip", text: p.text, field: "sw", go: p.obj ? () => pick(p.obj, p.field) : null })) : []; };
  /* choose an object from a list : the page shows it, its sheet opens, the value asked blinks under the pointer */
  function pick(id, field) { if (V.key !== "design") { location.hash = vHash("design", unsure(design()).some((u) => u.obj === id) ? "values" : "objects"); return; } if (!CANVAS.has(st.step) || st.step === "live") { st.step = unsure(design()).some((u) => u.obj === id) ? "values" : "objects"; mark(); }
    st.sel = { obj: id }; all(); const f = field ? right.querySelector(`[data-sw-param="${field}"]`) : right.querySelector("[data-sw-param].need, [data-sw-param]"); if (f) nudge(f); }
  const mark = () => { try { history.replaceState(null, "", vHash(V.key, st.step)); } catch (e) { /* a page without history */ } };
  const open = (key) => { if (!V.pages.includes(key)) { location.hash = vHash((vOfPage(key) || V).key, key); return; } st.step = key; mark(); all(); left.scrollTop = 0; };
  const addDevice = (key) => change(`Logiciel : ${DEVICES[key].label} posé`, (d) => { const free = (base) => { let n = 1, id = base; while (d.objects.some((o) => o.id === id)) id = `${base}_${++n}`; return id; }, y = Math.max(20, ...d.objects.map((o) => (o.y || 0) + 150)), P = devicePlacement(key, 20, y, free);
    for (const o of P.objects) { if (o.kind === "pin_adc") o.params.channel = Math.max(-1, ...d.objects.filter((q) => q.kind === "pin_adc").map((q) => Number((q.params || {}).channel) || 0)) + 1; if (o.kind === "pin_din" || o.kind === "pin_dout") o.params.pin = Math.max(-1, ...d.objects.filter((q) => q.kind === "pin_din" || q.kind === "pin_dout").map((q) => Number((q.params || {}).pin) || 0)) + 1; d.objects.push(o); }
    d.wires.push(...P.wires); if (P.scenario) { d.scenario = d.scenario || { steps: 200, pins: {} }; d.scenario.pins = { ...(d.scenario.pins || {}), ...P.scenario }; } st.sel = { obj: P.objects[P.objects.length - 1].id }; if (shows(lv, "autoPlace")) keyIn(d, P.objects[P.objects.length - 1].id); });
  /* a novice is given the block already keyed in : to the latest free output of the same key (sw/sw_blocks.js autoPlace) */
  const keyIn = (d, id) => { const a = autoPlace(d, id), o = d.objects.find((q) => q.id === id); if (!a || !o) return; o.x = a.x; o.y = a.y; if (a.params) o.params = { ...(o.params || {}), ...a.params }; d.wires.push(...a.wires); setTimeout(() => toast("Bloc emboîté tout seul sur la dernière sortie de la même clé. Glissez-le ailleurs pour le déboîter.", "success", 3500), 0); };
  /* a new block : off the rails of the board — a block of the software goes in the middle, a board output on the right rail */
  const add = (kind) => change(`Logiciel : ${KINDS[kind].label} posé`, (d) => { let n = 1; while (d.objects.some((o) => o.id === `${kind}_${n}`)) n++; const y = Math.max(20, ...d.objects.map((o) => (o.y || 0) + 150)); d.objects.push({ id: `${kind}_${n}`, kind, name: `${KINDS[kind].label} ${n}`, params: {}, sure: [], x: KINDS[kind].pin === "dout" ? 20 + 4 * 320 : KINDS[kind].pin ? 20 : 340, y }); st.sel = { obj: `${kind}_${n}` }; if (shows(lv, "autoPlace")) keyIn(d, `${kind}_${n}`); });

  /* ---------- the live bench : made when the step opens, gone when it closes ---------- */
  const stopBench = () => { if (bench) { bench.dispose(); bench = null; } rack = null; rackHost.replaceChildren(); };
  function ensureBench() { if (bench) return; bench = swBench({ design, lanes: shows(lv, "lanes"), onFrame: () => { if (!bench) return; canvas.values(bench.values); if (rack) rack.refresh(); for (const td of right.querySelectorAll("[data-ref]")) td.textContent = fr(bench.values(td.dataset.ref)); }, onLog: () => { if (bench && journalHost && journalHost.isConnected) journalHost.replaceChildren(bench.journal()); } }); }

  function renderLeft() {
    clear(left); const d = design(), cpu = d ? cpuOf(d) : null;
    left.append(el("div", { class: "side-head" }, el("h2", null, V.title)));
    if (d) { const ok = ready(d, cpu), n = unsure(d).length, zipBtn = btn("Fichiers C (.zip)", () => { const f = files(); download(`${d.id}-c.zip`, zip(f.map((x) => ({ name: x.name, bytes: x.text }))), "application/zip"); toast(`${f.length} fichiers écrits : la bibliothèque, les modules, leur structure, l'essai — et doc/LOADING.md, pour les charger dans le CPU.`, "success", 6000); },
      { primary: true, small: true, icon: "download", disabled: !ok, tip: ok ? "Le paquet : la bibliothèque, les modules, la structure de fichiers, l'essai et la marche à suivre pour le CPU" : n ? `${n} valeur${n > 1 ? "s" : ""} d'exemple à confirmer d'abord — étape 3` : "Le guide dit ce qui manque" }); zipBtn.dataset.swZip = "";
      left.append(el("div", { class: "side-actions" }, zipBtn, btn("Copier pour une IA", async () => toast((await copyText(aiText(d))) ? "Copié : le logiciel, ses objets et la consigne." : "Copie impossible.", "success", 4000), { small: true, icon: "sparkle", tip: "Confier le logiciel à un assistant : objets, fils, CPU, consigne" }), btn("Réimporter…", () => reimport(design, change), { small: true, icon: "wizard", tip: "Aperçu des changements, puis une seule étape annulable" }))); }
    if (d && V.key === "sim") { const hb = hostBoard(store.project, d), b = btn("Essayer sur la vraie carte", () => openHil(), { primary: true, icon: "chip", disabled: !hb, tip: hb ? `Pas à pas, comme la Manipulation en labo : la carte « ${hb.name || hb.id} » de l'Électronique, la sonde, l'alimentation, puis chaque entrée réglée et chaque sortie relevée — ce que le modèle attend, en volts` : "Aucune carte du produit avec un microcontrôleur : le PCBA de la carte de commande la donnera" });
      b.dataset.swHilOpen = ""; left.append(el("div", { class: "side-actions swl-hil" }, b)); }      // the software tried on its board (modules/sw_hil_ui.js)
    const scroll = el("div", { class: "side-scroll" }); left.append(scroll);
    scroll.append(stepCard(d, cpu, V.key, st.step, run, open));
    if (!d) return;
    if (st.step === "cpu") scroll.append(el("div", { class: "side-section", "data-box": "cpu", "data-fold-note": cpu.name }, el("h3", null, "Les CPU que l'outil connaît"),
      el("div", { class: "cf-tiles lab-blocks" }, cpuList().map((c) => tile({ sel: c.key === cpu.key, color: c.lockstep ? "#b45309" : "#64748b", label: c.key === "generic" ? "Générique" : c.name.replace(/^TMS570LS1224 \(|\)$/g, "").split(",")[0], small: c.lockstep ? "TMS570LS1224 · lockstep" : "fiche à remplir", tip: c.says, pic: icon("chip", "lab-cat"), data: { "data-cpu": c.key }, run: () => change(`Logiciel : CPU ${c.name}`, (x) => { x.cpu = c.key; }) }))),
      el("p", { class: "muted small" }, "Sa fiche est au centre : chaque chiffre avec la page de la fiche technique où il a été lu.")));
    if (st.step === "cpu") { const S = stdOf(d), L = levelOf(d), A = stdAsks(d);
      const ref = el("select", { "data-sw-std-ref": "", class: S ? "" : "need", onChange: (e) => change(`Logiciel : référence ${e.target.value || "aucune"}`, (x) => { x.std = e.target.value ? { ref: e.target.value, level: "" } : undefined; }) },
        el("option", { value: "", selected: !S }, "— à choisir —"), Object.values(STANDARDS).map((x) => el("option", { value: x.id, selected: S && S.id === x.id }, `${x.name} — ${x.domain}`)));
      const lvl = S ? el("select", { "data-sw-std-level": "", class: L ? "" : "need", onChange: (e) => change(`Logiciel : ${S.levelWord} ${e.target.value}`, (x) => { x.std = { ...x.std, level: e.target.value }; }) },
        el("option", { value: "", selected: !L }, "— à choisir —"), S.levels.map((l) => el("option", { value: l.id, selected: L && L.id === l.id }, `${S.levelWord} ${l.id}${l.fr ? ` — ${l.fr}` : ""}`))) : null;
      scroll.append(el("div", { class: "side-section", "data-box": "std", "data-fold-note": S ? `${S.name}${L ? ` ${S.levelWord} ${L.id}` : ""}` : "à choisir" }, el("h3", null, "La référence de sécurité"),
        el("p", { class: "muted small" }, "Au choix du projet : elle dit le niveau d'exigence que le logiciel doit tenir. Ce que l'outil en dit vient de pages publiques ; la norme elle-même n'a pas été lue."),
        el("label", { class: "field" }, el("span", { class: "field-label" }, "Référence"), ref), lvl ? el("label", { class: "field" }, el("span", { class: "field-label" }, S.levelWord), lvl) : null,
        el("ul", { class: "small sw-asks" }, A.lines.map((l) => el("li", null, l))),
        el("label", { class: "field" }, el("span", { class: "field-label" }, "Cadence du pas (ms)"), el("input", { type: "number", min: 1, max: 1000, step: 1, value: String(d.period || 10), "data-sw-period": "", onChange: (e) => { const v = Math.round(Number(e.target.value)); if (v >= 1 && v <= 1000) change(`Logiciel : pas de ${v} ms`, (x) => { x.period = v; }); } })))); }
    if (st.step === "objects") { const used = new Set(d.objects.map((o) => o.kind));
      scroll.append(libraryPalette({ pack: st.pack, setPack: (k) => { st.pack = k; renderLeft(); }, add, addDevice, used, packs: shows(lv, "packs"), planned: shows(lv, "planned"), only: lv === "novice" ? noviceOffers(used) : null, rawPins: shows(lv, "rawPins") }));
      if (lv !== "novice") scroll.append(reqImportSection({ design })); }
    if (st.step === "values") { const U = unsure(d), objs = d.objects.filter((o) => U.some((u) => u.obj === o.id));
      scroll.append(el("div", { class: "side-section", "data-box": "todo", "data-fold-note": `${U.length} à relire` }, el("h3", null, "Les valeurs à relire"), objs.length ? el("div", { "data-sw-todo": String(U.length) }, objs.map((o) => { const K = KINDS[o.kind], n = U.filter((u) => u.obj === o.id).length, N = NATURES.find((x) => x.id === K.nature);
        return el("button", { class: `nav-item${st.sel && st.sel.obj === o.id ? " active" : ""}`, type: "button", style: `box-shadow: inset 3px 0 0 ${N.color}`, "data-sw-todo-obj": o.id, onClick: () => pick(o.id) }, icon(K.icon), el("span", { class: "grow" }, o.name), el("small", null, `${n} à relire`)); })) : el("p", { class: "lab-note" }, icon("check"), " Toutes les valeurs ont été relues.")));
    }
    if (st.step === "live") { journalHost = el("div"); scroll.append(el("div", { class: "side-section", "data-box": "journal", "data-fold-note": "ce qui a basculé" }, el("h3", null, "Ce qui a basculé"), journalHost)); if (bench) journalHost.replaceChildren(bench.journal()); }
    if (st.step === "code") { const F = files(), cur0 = F.find((f) => f.name === st.file) || F[0];
      scroll.append(el("div", { class: "side-section", "data-box": "files", "data-fold-note": `${F.length} fichiers` }, el("h3", null, "Le paquet, fichier par fichier"),
        F.filter((f) => f.name === "bms/README.md").map((f) => el("button", { class: "nav-item" + (cur0 && f.name === cur0.name ? " active" : ""), type: "button", "data-sw-file": f.name, onClick: () => { st.file = f.name; all(); } }, icon("info"), el("span", { class: "grow" }, "README.md — à lire d'abord"))),
        Object.entries(FOLDERS).map(([dir, [c, what]]) => { const mine = F.filter((f) => f.name.startsWith(`bms/${dir}/`)); return mine.length ? [el("p", { class: "ft-label rd-group", style: `--dom:${c}` }, `${dir}/ — ${what}`), mine.map((f) => el("button", { class: "nav-item" + (cur0 && f.name === cur0.name ? " active" : ""), type: "button", "data-sw-file": f.name, onClick: () => { st.file = f.name; all(); } }, icon("code"), el("span", { class: "grow" }, f.name.replace(`bms/${dir}/`, "")), el("small", null, `${f.text.split("\n").length} l.`)))] : null; })));
    }
    if (st.step === "load") scroll.append(releaseList(d, cpu, run, (k, page) => { location.hash = vHash(k, page); }), docsSection(d));
    if (st.step === "load") scroll.append(el("div", { class: "side-section", "data-box": "pack", "data-fold-note": "" }, el("h3", null, "Le paquet"), el("p", { class: "muted small" }, "Tout ce qui est décrit au centre est aussi écrit dans le paquet, en anglais : doc/LOADING.md."),
      btn("Lire doc/LOADING.md", () => { st.file = "bms/doc/LOADING.md"; open("code"); }, { small: true, icon: "code" })));
    const g = shows(lv, "guideList") ? guideBox(guide(), { title: "Ce que le logiciel demande", quiet: "Rien à signaler : le paquet peut être écrit." }) : null; if (g) scroll.append(el("div", { class: "side-section", "data-box": "guide", "data-fold-note": "le guide" }, el("h3", null, "À régler — le guide"), g));
  }

  function renderRight() {
    clear(right); journalHost = journalHost && journalHost.isConnected ? journalHost : null; const d = design(); if (!d || !RIGHT.has(st.step)) return;
    const o = st.sel && st.sel.obj ? d.objects.find((x) => x.id === st.sel.obj) : null, w = st.sel && st.sel.wire ? d.wires.find((x) => x.from === st.sel.wire.from && x.to === st.sel.wire.to) : null;
    right.append(el("div", { class: "side-head" }, el("h2", null, st.step === "live" ? "Le banc" : o ? o.name : w ? "Un fil" : d.name || "Logiciel")));
    const body = el("div", { class: "side-scroll" }); right.append(body);
    if (st.step === "live") { const at = el("div");
      body.append(el("div", { class: "side-section", "data-box": "bench", "data-fold-note": "les instruments" }, el("h3", null, "Le banc du logiciel"), el("p", { class: "muted small" }, "Comme au Labo d'une carte, les instruments sont au-dessus des blocs : une source par entrée du logiciel, réglée sur sa face — sa valeur dans l'unité du capteur, les comptes qu'elle met à la broche —, et les témoins de ce que le logiciel commande. Changez une source pendant la marche, ou en pause puis « Un pas »."), at));
      if (o) sheet(body, { d, sel: st.sel, change, live: true, level: lv, values: bench ? { ...bench.L.m.last } : null, onGone: () => { st.sel = null; } });
      else body.append(el("p", { class: "muted small" }, "Un clic sur une tuile montre ici ce qui y entre et ce qui en sort, en direct."));
      return; }
    sheet(body, { d, sel: st.sel, change, level: lv, values: valuesAt(), onGone: () => { st.sel = null; } });
    if (!o && !w && R) { const ev = events(d, R), name = (ref) => { const [id, key] = split(ref), x = d.objects.find((q) => q.id === id); return `${x ? x.name : id} — ${key}`; };
      body.append(el("div", { class: "side-section", "data-fold-note": `${R.t.length} pas` }, el("h3", null, "Le scénario rejoué"), el("p", { class: "muted small" }, "Le modèle est rejoué contre le scénario de l'exemple ; le curseur sous la page montre chaque instant. Pour tenir le banc vous-même : étape 5."),
        ev.length ? el("ul", { class: "lab-list", "data-sw-events": String(ev.length) }, ev.map((e) => el("li", null, el("button", { class: "link", type: "button", onClick: () => { st.k = R.t.indexOf(e.t); const s = replay.querySelector("[data-sw-pos]"); if (s) s.value = String(st.k); paint(); renderRight(); } }, `${e.t} ms`), ` — ${name(e.ref)} passe à ${e.to}`))) : el("p", { class: "muted" }, "Rien ne bascule dans ce scénario."))); }
  }
  function renderReplay() { clear(replay); const d = design(); if (!d || !R || !R.t.length) return; replay.append(el("span", { class: "chip" }, "Scénario"), el("input", { type: "range", min: 0, max: R.t.length - 1, value: String(Math.min(st.k, R.t.length - 1)), "data-sw-pos": "", "aria-label": "Instant du scénario", onInput: (e) => { st.k = Number(e.target.value); paint(); } }), el("span", { class: "chip", "data-sw-now": "" }, `${R.t[Math.min(st.k, R.t.length - 1)]} ms`), el("span", { class: "muted small" }, `pas de ${d.period || 10} ms · chaque sortie montre ce qu'elle vaut à cet instant`)); }
  function paint() { const d = design(); if (!d || !CANVAS.has(st.step)) return; canvas.draw(d, st.step === "live" ? null : R, st.k, st.sel); if (st.step === "live" && bench) canvas.values(bench.values); const s = replay.querySelector("[data-sw-now]"); if (s && R) s.textContent = `${R.t[Math.min(st.k, R.t.length - 1)] ?? 0} ms`; }
  function centre(d) { const cpu = cpuOf(d); if (st.step === "cpu") return cpuPage(d, cpu); if (st.step === "start") return startPage(d, cpu); if (st.step === "load") return loadPage(d, cpu);
    const F = files(); return codePage(F, F.find((f) => f.name === st.file) || F[0], FOLDERS); }

  function all() {
    const d = design(); R = d ? simulate(d) : null; if (R && st.k >= R.t.length) st.k = Math.max(0, R.t.length - 1); run = d ? runAll(d) : null;
    head.replaceChildren(vBand(d, d ? cpuOf(d) : null, V.key, run, d ? stdAsks(d).lines[0] : "Le logiciel n'existe pas encore."));
    const onCanvas = !!d && CANVAS.has(st.step), showRight = !!d && RIGHT.has(st.step), errs = d ? problems(d, cpuOf(d)).filter((p) => p.level === "error") : [];
    root.classList.toggle("no-right", !showRight); right.hidden = !showRight; empty.hidden = !!d; host.hidden = !onCanvas; pageHost.hidden = !d || onCanvas; replay.hidden = !onCanvas || st.step === "live"; liveBox.hidden = !d || st.step !== "live";
    if (!d) { stopBench(); clear(empty); empty.append(el("div", { class: "empty" }, el("h2", null, "Le logiciel du BMS, par objets"), el("p", null, "Chaque chose que le CPU doit gérer est une tuile posée sur la page : elle connaît ses entrées, ses sorties, leurs plages. Vous reliez les tuiles ; l'outil écrit le C — une bibliothèque, des modules, leur structure de fichiers —, le fait tourner devant vous, et dit comment le charger dans le CPU."),
      el("div", { class: "form-actions" }, (() => { const b = btn("Partir de mes exigences…", () => openImport({ design }), { primary: true, icon: "upload", tip: "Le format standard : un assistant y convertit votre document, l'outil pose les blocs" }); b.dataset.swReqStart = ""; return b; })(),
      (() => { const b = btn("Partir de l'exemple", () => store.commit("Logiciel : exemple posé", (p) => { p.software = [demoDesign()]; }), { icon: "play" }); b.dataset.swDemo = ""; return b; })()))); renderLeft(); clear(right); setGuide([]); return; }
    if (st.step === "live" && !errs.length) { ensureBench(); if (!rack && bench) { rack = swRack(bench, design); rackHost.replaceChildren(rack.node); } } else stopBench();
    rackHost.hidden = !rack;
    clear(liveHost); if (st.step === "live") { if (bench) liveHost.append(bench.bar, el("div", { class: "sw-lanes-box bottom-body" }, el("p", { class: "muted small" }, "CHRONOGRAMME · les dernières secondes — une voie par décision (verte à 0, rouge à 1) et par mesure (orange), comme un analyseur logique."), bench.chart)); else liveHost.append(el("p", { class: "form-error", "data-sw-live-blocked": "" }, `Le banc attend un logiciel sans erreur : ${errs[0] ? errs[0].text : ""}`)); }
    if (!onCanvas) pageHost.replaceChildren(centre(d));
    renderLeft(); renderRight(); renderReplay(); paint(); setGuide(guide()); setStatus(ready(d, cpuOf(d)) ? "Logiciel prêt à écrire" : "Logiciel : à régler", ready(d, cpuOf(d)) ? "done" : "");
  }
  const off = store.on("change", () => { if (!st.alive) return; if (bench) { stopBench(); } all(); });
  all();
  return () => { st.alive = false; off(); stopBench(); canvas.destroy(); setGuide([]); };
}
/* the five steps of the V this file draws : each a screen of the group Logiciel */
for (const k of ["arch", "design", "sim", "code", "release"]) { const V = vstepOf(k); registerModule({ key: V.mod, label: V.title, icon: V.icon, tip: `${V.n}. ${V.long} — ${V.en}`, render: (main, args) => render(main, args, k) }); }
