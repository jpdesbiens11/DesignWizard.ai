/* DesignWizard.ai — Logiciel : the software of an embedded BMS, drawn as objects one links, and written by the tool (demande de JP :
   « une approche de design logiciel via des objets visuels adaptés qui se codent tout seuls en librairie, module et structure de
   fichiers pour un CPU de BMS embarqué, sachant les in/out à gérer, leurs plages et le CPU choisi »).
   The same three places as every studio. Left, what one gives : the CPU chosen — its sheet, each figure with the page it was read on —,
   the objects one can put on the page, by nature, and what the guide asks. Centre, what one looks at : the tiles and their wires, each
   output with what it is worth at the instant of the timeline under it. Right, what one sets and what one gets : the sheet of the object
   chosen (a value the tool proposed blinks until it is entered or confirmed), the files the tool writes, and the run of the scenario.
   Every change is one step of the store : Ctrl + Z takes it back. The models are sw/sw_objects.js, sw/sw_design.js, sw/sw_c.js and
   sw/sw_cpu.js ; the page is modules/sw_canvas.js. The tool calls no assistant : the round trip is a text one copies and pastes. */

import { el, clear, icon, btn, field, onOff, toast, download, confirmBox, copyText, modal } from "../core/dom.js";
import { store } from "../core/store.js";
import { registerModule, setGuide, setStatus } from "../core/app.js";
import { guideBox, needField, nudge } from "../core/guide.js";
import { zip } from "../core/zip.js";
import { KINDS, NATURES, cfgOf, paramUnit } from "../sw/sw_objects.js";
import { demoDesign, problems, unsure, ready, simulate, events, wireCheck, order, split } from "../sw/sw_design.js";
import { cFiles, requirement } from "../sw/sw_c.js";
import { cpuOf, cpuList, CPU_SOURCES } from "../sw/sw_cpu.js";
import { swCanvas } from "./sw_canvas.js";

const FOLDERS = { lib: ["#0891b2", "un module par genre d'objet"], cfg: ["#7c3aed", "une table par objet posé"], io: ["#64748b", "signal ↔ broche"], app: ["#16a34a", "le pas du logiciel"], hal: ["#b45309", "ce qui touche le CPU"], test: ["#dc2626", "le scénario rejoué"], doc: ["#475569", "objet ↔ fichiers ↔ exigence"] };
const LEVEL = { error: "error", todo: "todo", check: "warn" };
const tile = (o) => el("button", { class: `cf-tile${o.sel ? " sel" : ""}`, type: "button", "aria-pressed": o.sel === undefined ? null : o.sel ? "true" : "false", "data-tip": o.tip || null, style: `--dom:${o.color}`, onClick: o.run, ...o.data }, o.pic, el("b", null, o.label), o.small ? el("small", null, o.small) : null);

function render(main) {
  clear(main);
  const left = el("aside", { class: "side" }), view = el("div", { class: "viewport sw-view" }), right = el("aside", { class: "side right" }), root = el("div", { class: "studio" }, left, view, right); root.style.setProperty("--right-w", "400px"); main.append(root);
  const st = { sel: null, k: 0, tab: "obj", file: "bms/app/bms_app.c", alive: true }, design = () => (store.project && (store.project.software || [])[0]) || null;
  const change = (label, fn) => store.commit(label, (p) => { p.software = p.software || []; if (!p.software[0]) return; fn(p.software[0]); });
  const host = el("div", { class: "sw-host" }), bar = el("div", { class: "lab-bar sw-bar" }), empty = el("div", { class: "page", hidden: true }); view.append(empty, host, bar);
  const canvas = swCanvas(host, {
    onPick: (s) => { st.sel = s; st.tab = "obj"; paint(); renderRight(); },
    onMove: (id, x, y) => change(`Logiciel : ${id} déplacé`, (d) => { const o = d.objects.find((q) => q.id === id); if (o) { o.x = x; o.y = y; } }),
    onWire: (from, to) => { const d = design(), c = wireCheck(d, from, to); if (!c.ok) { toast(c.text, "error", 7000); paint(); return; }
      const loops = order({ ...d, wires: [...d.wires.filter((w) => w.to !== to), { from, to }] }).loop.length > 0;
      change(`Logiciel : fil ${from} → ${to}`, (x) => { x.wires = x.wires.filter((w) => w.to !== to); x.wires.push({ from, to, ...(loops ? { delay: true } : {}) }); });
      toast(loops ? "Ce fil ferme une boucle : il porte la valeur du pas d'avant, comme le font les schémas-blocs. Un clic sur le fil pour le voir." : c.level ? c.text : "Fil posé.", loops || c.level ? "info" : "success", loops || c.level ? 7000 : 2200); } });
  const run = () => { const d = design(); return d ? simulate(d) : null; };
  let R = null;
  function paint() { const d = design(); if (!d) return; canvas.draw(d, R, st.k, st.sel); const s = bar.querySelector("[data-sw-now]"); if (s && R) s.textContent = `${R.t[Math.min(st.k, R.t.length - 1)] ?? 0} ms`; }
  const guide = () => { const d = design(); return d ? problems(d, cpuOf(d)).map((p) => ({ level: LEVEL[p.level] || "tip", text: p.text, field: "sw", go: p.obj ? () => { st.sel = { obj: p.obj }; st.tab = "obj"; paint(); renderRight(); const f = p.field ? right.querySelector(`[data-sw-param="${p.field}"]`) : right.querySelector("[data-sw-param]"); if (f) nudge(f); } : null })) : []; };
  const files = () => { const d = design(); return d ? cFiles(d, { cpu: cpuOf(d) }) : []; };
  const add = (kind) => change(`Logiciel : ${KINDS[kind].label} posé`, (d) => { let n = 1; while (d.objects.some((o) => o.id === `${kind}_${n}`)) n++; const y = Math.max(20, ...d.objects.map((o) => (o.y || 0) + 150)); d.objects.push({ id: `${kind}_${n}`, kind, name: `${KINDS[kind].label} ${n}`, params: {}, sure: [], x: 20, y }); st.sel = { obj: `${kind}_${n}` }; });

  function renderLeft() {
    clear(left); const d = design();
    left.append(el("div", { class: "side-head" }, el("h2", null, "Logiciel")));
    if (!d) { left.append(el("div", { class: "side-scroll" }, el("p", { class: "atelier-hint" }, icon("info"), " Aucun logiciel dans ce projet. L'exemple pose une chaîne entière : une tension de cellule surveillée, une surtension qui ouvre le contactor, l'énergie comptée."))); return; }
    const cpu = cpuOf(d), ok = ready(d, cpu), n = unsure(d).length, zipBtn = btn("Fichiers C (.zip)", () => { const f = files(); download(`${d.id}-c.zip`, zip(f.map((x) => ({ name: x.name, bytes: x.text }))), "application/zip"); toast(`${f.length} fichiers écrits : une bibliothèque, des modules, leur structure — et l'essai dos à dos.`, "success", 5000); },
      { primary: true, small: true, icon: "download", disabled: !ok, tip: ok ? "La bibliothèque, les modules, la structure de fichiers et l'essai qui compare le C au modèle" : n ? `${n} valeur${n > 1 ? "s" : ""} d'exemple à confirmer d'abord — le guide y mène` : "Le guide dit ce qui manque" }); zipBtn.dataset.swZip = "";
    left.append(el("div", { class: "side-actions" }, zipBtn, btn("Copier pour une IA", async () => toast((await copyText(aiText(d))) ? "Copié : le logiciel, ses objets et la consigne." : "Copie impossible.", "success", 4000), { small: true, icon: "sparkle", tip: "Confier le logiciel à un assistant : objets, fils, CPU, consigne" }), btn("Réimporter…", reimport, { small: true, icon: "wizard", tip: "Aperçu des changements, puis une seule étape annulable" })));
    const scroll = el("div", { class: "side-scroll" }); left.append(scroll);
    scroll.append(el("div", { class: "side-section", "data-box": "cpu", "data-fold-note": cpu.name }, el("h3", null, "Le CPU choisi"),
      el("div", { class: "cf-tiles lab-blocks" }, cpuList().map((c) => tile({ sel: c.key === cpu.key, color: c.lockstep ? "#b45309" : "#64748b", label: c.key === "generic" ? "Générique" : c.name.replace(/^TMS570LS1224 \(|\)$/g, "").split(",")[0], small: c.lockstep ? "TMS570LS1224 · lockstep" : "fiche à remplir", tip: c.says, pic: icon("chip", "lab-cat"), data: { "data-cpu": c.key }, run: () => change(`Logiciel : CPU ${c.name}`, (x) => { x.cpu = c.key; }) }))),
      el("p", { class: "muted small" }, `${cpu.adc.modules > 1 ? `${cpu.adc.modules} convertisseurs` : "Un convertisseur"} de ${cpu.adc.bits} bits, ${cpu.adc.channels} voies ; ${cpu.gio} broches logiques au plus ; ${cpu.can} CAN, ${cpu.uart} UART.${cpu.lockstep ? " Deux cœurs en lockstep." : ""}`),
      cpu.facts.length ? el("table", { class: "data sw-facts" }, el("tbody", null, cpu.facts.map((f) => el("tr", null, el("td", null, el("b", null, f.what), el("br"), f.value), el("td", { class: "muted" }, f.page))))) : null,
      el("p", { class: "lab-note", "data-cpu-says": "" }, icon("info"), " ", cpu.says), cpu.source ? el("p", { class: "muted small" }, `${CPU_SOURCES[0].maker} — ${CPU_SOURCES[0].doc}. ${CPU_SOURCES[0].read}`) : null));
    scroll.append(el("div", { class: "side-section", "data-box": "kinds", "data-fold-note": `${Object.keys(KINDS).length}` }, el("h3", null, "Poser un objet"),
      NATURES.map((N) => [el("p", { class: "ft-label rd-group", style: `--dom:${N.color}` }, `${N.fr} — ${N.label}`), el("div", { class: "cf-tiles lab-blocks" }, Object.entries(KINDS).filter(([, K]) => K.nature === N.id).map(([k, K]) => tile({ color: N.color, label: K.label, small: K.fr, tip: K.text, pic: icon(K.icon, "lab-cat"), data: { "data-kind": k }, run: () => add(k) })))])));
    const g = guideBox(guide(), { title: "Ce que le logiciel demande", quiet: "Rien à signaler : les fichiers peuvent être écrits." }); if (g) scroll.append(el("div", { class: "side-section", "data-box": "guide" }, el("h3", null, "À régler"), g));
  }
  const aiText = (d) => ["Tu es l'assistant de conception de DesignWizard.ai. Voici le logiciel embarqué d'un BMS, décrit comme des OBJETS reliés par des fils : chaque objet a un genre (kind), des paramètres, et des ports ; un fil va d'une sortie « objet.port » à une entrée « objet.port ».",
    `GENRES DISPONIBLES — ${Object.entries(KINDS).map(([k, K]) => `${k} (${K.label} : entrées ${K.ports.in.map((p) => p.key).join(", ") || "aucune"} ; sorties ${K.ports.out.map((p) => p.key).join(", ") || "aucune"} ; paramètres ${K.params.map((p) => p.key).join(", ") || "aucun"})`).join(" · ")}.`,
    `CPU CHOISI — ${cpuOf(d).name} : ${cpuOf(d).adc.channels} voies analogiques de ${cpuOf(d).adc.bits} bits, ${cpuOf(d).gio} broches logiques.`,
    "TA TÂCHE — relis ce logiciel comme un ingénieur de logiciel embarqué : un objet qui manque, un seuil ou un délai qui te paraît faux, une entrée non reliée. Dis-le en quelques lignes, puis attends mon accord.",
    "RÉPONSE ATTENDUE — un seul bloc ```json avec le logiciel entier, même forme. Toute valeur que tu changes ou ajoutes reste un EXEMPLE : ne l'inscris pas dans « sure ». N'invente pas de genre d'objet.", "", "```json", JSON.stringify(d, null, 1), "```"].join("\n");
  function reimport() {
    const area = el("textarea", { rows: 9, placeholder: "Collez la réponse de l'assistant : elle contient le logiciel dans un bloc ```json." }), out = el("div"); let next = null;
    const ok = btn("Appliquer ces changements", () => { if (!next) return; change("Logiciel : réponse de l'IA", (d) => { for (const k of Object.keys(d)) delete d[k]; Object.assign(d, next); }); m.close(); toast("Logiciel mis à jour. Ctrl + Z pour revenir.", "success"); }, { primary: true, icon: "check", disabled: true });
    area.addEventListener("input", () => { next = null; ok.disabled = true; out.replaceChildren(); if (!area.value.trim()) return;
      try { const m2 = area.value.match(/```json\s*([\s\S]*?)```/), doc = JSON.parse(m2 ? m2[1] : area.value), now = design(); if (!doc || !Array.isArray(doc.objects) || !Array.isArray(doc.wires)) throw new Error("La réponse ne contient pas un logiciel (objects, wires)."); const bad = doc.objects.filter((o) => !KINDS[o.kind]); if (bad.length) throw new Error(`Genre d'objet inconnu : ${bad.map((o) => o.kind).join(", ")}.`);
        const was = new Map(now.objects.map((o) => [o.id, JSON.stringify({ ...o, x: 0, y: 0 })])), lines = []; for (const o of doc.objects) { const w = was.get(o.id); if (w === undefined) lines.push(`+ ${o.name || o.id} (${KINDS[o.kind].label}) — créé`); else if (w !== JSON.stringify({ ...o, x: 0, y: 0 })) lines.push(`~ ${o.name || o.id} — modifié`); was.delete(o.id); }
        for (const id of was.keys()) lines.push(`− ${id} — retiré`); const wn = JSON.stringify(now.wires) !== JSON.stringify(doc.wires); if (wn) lines.push(`~ les fils : ${now.wires.length} → ${doc.wires.length}`);
        /* a value an answer changed or brought is an example : it is not taken for confirmed */
        const old = new Map(now.objects.map((o) => [o.id, o])); doc.objects = doc.objects.map((o) => { const p = old.get(o.id), c0 = p ? cfgOf(p) : {}, c1 = cfgOf(o); return { ...o, sure: (p ? p.sure || [] : []).filter((k) => c0[k] === c1[k]) }; });
        const ps = problems(doc, cpuOf(doc)).filter((p) => p.level === "error"); out.append(el("p", null, lines.length ? `${lines.length} changement(s) :` : "Aucun changement."), el("ul", { class: "decisions" }, lines.slice(0, 30).map((t) => el("li", null, t))), ...(ps.length ? [el("p", { class: "form-error" }, `Ce que cela dérange : ${ps.map((p) => p.text).join(" ")}`)] : []));
        if (lines.length) { next = doc; ok.disabled = false; } } catch (e) { out.append(el("p", { class: "form-error" }, e.message)); } });
    const m = modal("Réimporter le logiciel depuis une IA", [field("Réponse de l'assistant", area), out, el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), ok)], { wide: true });
  }
  function renderRight() {
    clear(right); const d = design(); if (!d) return; const o = st.sel && st.sel.obj ? d.objects.find((x) => x.id === st.sel.obj) : null, w = st.sel && st.sel.wire ? d.wires.find((x) => x.from === st.sel.wire.from && x.to === st.sel.wire.to) : null;
    right.append(el("div", { class: "side-head" }, el("h2", null, o ? o.name : w ? "Un fil" : d.name || "Logiciel")), el("div", { class: "subtabs", style: { margin: "0 .6rem" }, role: "tablist" }, [["obj", "Objet"], ["files", "Fichiers"], ["run", "Essai"]].map(([k, l]) => el("button", { class: "subtab" + (st.tab === k ? " active" : ""), type: "button", role: "tab", "aria-selected": st.tab === k ? "true" : "false", "data-tab": k, onClick: () => { st.tab = k; renderRight(); } }, l))));
    const body = el("div", { class: "side-scroll" }); right.append(body); const sec = (title, note, ...kids) => { const x = el("div", { class: "side-section", "data-fold-note": note }, el("h3", null, title), ...kids.flat().filter(Boolean)); body.append(x); return x; };
    if (st.tab === "obj") {
      if (o) { const K = KINDS[o.kind], N = NATURES.find((n) => n.id === K.nature), c = cfgOf(o), mine = (o.sure || []), left0 = K.params.filter((p) => !mine.includes(p.key));
        body.append(el("p", { class: "lab-nature", style: `--dom:${N.color}` }, icon(K.icon), el("span", null, el("b", null, `${K.label} — ${K.fr}`), el("small", null, `${N.fr} · ${K.text}`))));
        sec("L'objet", o.off ? "à Off" : "à On", field("Nom", el("input", { type: "text", value: o.name, "data-sw-name": "", onChange: (e) => change(`Logiciel : ${o.id} renommé`, (x) => { x.objects.find((q) => q.id === o.id).name = e.target.value.trim() || o.id; }) })),
          el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, onOff(!o.off, (on) => change(`Logiciel : ${o.name} ${on ? "à On" : "à Off"}`, (x) => { const q = x.objects.find((z) => z.id === o.id); if (on) delete q.off; else q.off = true; }), o.name, o.off ? "Cet objet est de côté : il n'est ni simulé ni écrit — cliquer pour le remettre" : "Mettre cet objet de côté sans le perdre"),
            btn("Dupliquer", () => change(`Logiciel : ${o.name} dupliqué (copie à Off)`, (x) => { let n = 2; while (x.objects.some((z) => z.id === `${o.id}_${n}`)) n++; x.objects.push({ ...JSON.parse(JSON.stringify(o)), id: `${o.id}_${n}`, name: `${o.name} (copie)`, off: true, x: (o.x || 0) + 20, y: (o.y || 0) + 30 }); }), { small: true, icon: "copy", tip: "La copie naît à Off, sans fils" }),
            btn("Supprimer", () => { change(`Logiciel : ${o.name} supprimé`, (x) => { x.objects = x.objects.filter((z) => z.id !== o.id); x.wires = x.wires.filter((q) => split(q.from)[0] !== o.id && split(q.to)[0] !== o.id); }); st.sel = null; }, { small: true, icon: "trash", danger: true })));
        if (K.params.length) sec("Ses valeurs", left0.length ? `${left0.length} à confirmer` : "confirmées", K.params.map((p) => { const U = paramUnit(o, p), set = (v) => change(`Logiciel : ${o.name} — ${p.label}`, (x) => { const q = x.objects.find((z) => z.id === o.id); q.params = q.params || {}; q.params[p.key] = v; q.sure = [...new Set([...(q.sure || []), p.key])]; });
          const input = p.choices ? el("select", { "data-sw-param": p.key, onChange: (e) => set(typeof p.value === "number" ? Number(e.target.value) : e.target.value) }, p.choices.map((v) => el("option", { value: v, selected: v === c[p.key] }, String(v)))) : el("input", { type: "number", step: "1", value: String(c[p.key]), min: p.min, max: p.max, "data-sw-param": p.key, onChange: (e) => { const v = Math.round(Number(e.target.value)); if (Number.isFinite(v)) set(v); } });
          if (!mine.includes(p.key)) needField(input, { hint: "Une valeur d'exemple proposée par l'outil : tapez la vôtre, ou confirmez-la." }); return field(`${p.label}${U ? ` (${U})` : ""}`, input, p.text || null); }),
          left0.length ? (() => { const b = btn(`Confirmer ${left0.length > 1 ? `ces ${left0.length} valeurs` : "cette valeur"}`, () => change(`Logiciel : valeurs de ${o.name} confirmées`, (x) => { x.objects.find((z) => z.id === o.id).sure = K.params.map((p) => p.key); }), { small: true, icon: "check", tip: "Vous avez relu ces valeurs : elles ne sont plus des exemples" }); b.dataset.swSure = ""; return b; })() : null);
        sec("Ce qu'il doit faire", "", el("p", { class: "lab-why", "data-sw-req": "" }, requirement(d, o)), el("p", { class: "muted small" }, "Cette phrase est écrite d'après les valeurs et les fils : elle va dans doc/TRACE.md, à côté des fichiers de l'objet."));
      } else if (w) { const c = wireCheck(d, w.from, w.to);
        sec("Le fil", w.delay ? "valeur du pas d'avant" : "", el("p", { class: "lab-why" }, `${w.from} → ${w.to}`), c.text ? el("p", { class: c.ok ? "lab-note" : "form-error" }, c.text) : null,
          el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, onOff(!!w.delay, (on) => change(`Logiciel : fil ${w.from} → ${w.to}`, (x) => { const q = x.wires.find((z) => z.from === w.from && z.to === w.to); if (on) q.delay = true; else delete q.delay; }), "valeur du pas d'avant", "Ce fil porte la valeur du pas d'avant : ce qui ouvre une boucle, comme dans un schéma-bloc"), el("span", null, "Valeur du pas d'avant"),
            btn("Retirer le fil", () => { change(`Logiciel : fil ${w.from} → ${w.to} retiré`, (x) => { x.wires = x.wires.filter((z) => !(z.from === w.from && z.to === w.to)); }); st.sel = null; }, { small: true, icon: "trash", danger: true })));
      } else { const n = unsure(d).length;
        sec("Le logiciel", `${d.objects.length} objets`, el("p", { class: "lab-why" }, "Un clic sur une tuile ouvre sa fiche ; sa tête se glisse pour la déplacer. Un clic sur une sortie, puis sur une entrée, tire un fil — l'outil le refuse quand les unités ne s'accordent pas."),
          field("Période du pas (ms)", el("input", { type: "number", min: 1, max: 1000, step: 1, value: String(d.period || 10), "data-sw-period": "", onChange: (e) => { const v = Math.round(Number(e.target.value)); if (v >= 1) change("Logiciel : période du pas", (x) => { x.period = v; }); } }), "Tous les combien le logiciel refait son pas : les délais se comptent en pas."),
          n ? (() => { const b = btn(`Confirmer les ${n} valeurs d'exemple…`, async () => { if (await confirmBox("Confirmer toutes les valeurs", `Les ${n} valeurs proposées par l'outil — seuils, délais, échelles, numéros de broches — seront tenues pour relues. Faites-le seulement si vous les avez lues.`, "Je les ai relues")) change("Logiciel : toutes les valeurs confirmées", (x) => { for (const q of x.objects) if (KINDS[q.kind]) q.sure = KINDS[q.kind].params.map((p) => p.key); }); }, { small: true, icon: "check" }); b.dataset.swSureAll = ""; return b; })() : null); }
    } else if (st.tab === "files") { const F = files(), cur = F.find((f) => f.name === st.file) || F[0], cpu = cpuOf(d);
      sec("Ce que l'outil écrit", `${F.length} fichiers`, el("p", { class: "muted small" }, `C99 sobre : pas d'allocation, types à largeur fixe, aucun nombre à virgule. C'est un SQUELETTE : il n'a tourné sur aucun microcontrôleur, et le code des registres du ${cpu.key === "generic" ? "CPU" : "TMS570"} reste à écrire avec la bibliothèque de son fabricant. Aucune prétention de certification.`),
        Object.entries(FOLDERS).map(([dir, [c, what]]) => { const mine = F.filter((f) => f.name.startsWith(`bms/${dir}/`)); return mine.length ? [el("p", { class: "ft-label rd-group", style: `--dom:${c}` }, `${dir}/ — ${what}`), mine.map((f) => el("button", { class: "nav-item" + (cur && f.name === cur.name ? " active" : ""), type: "button", "data-sw-file": f.name, onClick: () => { st.file = f.name; renderRight(); } }, icon("code"), el("span", { class: "grow" }, f.name.replace(`bms/${dir}/`, "")), el("small", null, `${f.text.split("\n").length} l.`)))] : null; }),
        F.filter((f) => f.name === "bms/README.md").map((f) => el("button", { class: "nav-item" + (cur && f.name === cur.name ? " active" : ""), type: "button", "data-sw-file": f.name, onClick: () => { st.file = f.name; renderRight(); } }, icon("info"), el("span", { class: "grow" }, "README.md"))));
      if (cur) sec(cur.name.replace("bms/", ""), "", el("pre", { class: "code sw-code", "data-sw-code": cur.name, tabindex: 0 }, cur.text));
    } else { const ev = R ? events(d, R) : [], name = (ref) => { const [id, key] = split(ref), x = d.objects.find((q) => q.id === id); return `${x ? x.name : id} — ${key}`; };
      sec("Le scénario rejoué", R ? `${R.t.length} pas` : "", el("p", { class: "lab-why" }, "Le modèle est rejoué pas à pas contre le scénario du banc : la demande de fermeture, la cellule qui monte, le contact qui suit. Le curseur sous la page montre chaque instant ; le programme d'essai en C rejoue le même scénario, et doit imprimer les mêmes nombres."),
        ev.length ? el("ul", { class: "lab-list", "data-sw-events": String(ev.length) }, ev.map((e) => el("li", null, el("button", { class: "link", type: "button", onClick: () => { st.k = R.t.indexOf(e.t); const s = bar.querySelector("[data-sw-pos]"); if (s) s.value = String(st.k); paint(); } }, `${e.t} ms`), ` — ${name(e.ref)} passe à ${e.to}`))) : el("p", { class: "muted" }, "Rien ne bascule dans ce scénario."),
        el("p", { class: "muted small" }, "Les valeurs du scénario sont celles d'un exemple. Les pannes injectées à la main et la ligne de temps complète viendront avec le banc du pack."));
    }
  }
  function renderBar() { clear(bar); const d = design(); if (!d || !R || !R.t.length) return; bar.append(el("span", { class: "chip" }, "Instant"), el("input", { type: "range", min: 0, max: R.t.length - 1, value: String(Math.min(st.k, R.t.length - 1)), "data-sw-pos": "", "aria-label": "Instant du scénario", onInput: (e) => { st.k = Number(e.target.value); paint(); } }), el("span", { class: "chip", "data-sw-now": "" }, `${R.t[Math.min(st.k, R.t.length - 1)]} ms`), el("span", { class: "muted small" }, `pas de ${d.period || 10} ms · chaque sortie montre ce qu'elle vaut à cet instant`)); }
  function all() { const d = design(); R = run(); if (R && st.k >= R.t.length) st.k = Math.max(0, R.t.length - 1);
    host.hidden = bar.hidden = !d; empty.hidden = !!d; root.classList.toggle("no-right", !d); right.hidden = !d;
    if (!d) { clear(empty); empty.append(el("div", { class: "empty" }, el("h2", null, "Le logiciel du BMS, par objets"), el("p", null, "Chaque chose que le CPU doit gérer est un objet posé sur la page : il connaît ses entrées, ses sorties, leurs plages. Vous reliez les objets ; l'outil écrit le C — une bibliothèque, des modules, leur structure de fichiers — et prouve, en le compilant, qu'il fait ce que le dessin dit."),
      (() => { const b = btn("Partir de l'exemple", () => store.commit("Logiciel : exemple posé", (p) => { p.software = [demoDesign()]; }), { primary: true, icon: "play" }); b.dataset.swDemo = ""; return b; })())); renderLeft(); clear(right); setGuide([]); return; }
    renderLeft(); renderRight(); renderBar(); paint(); setGuide(guide()); setStatus(ready(d, cpuOf(d)) ? "Logiciel prêt à écrire" : "Logiciel : à régler", ready(d, cpuOf(d)) ? "done" : ""); }
  const off = store.on("change", () => { if (st.alive) all(); });
  all();
  return () => { st.alive = false; off(); canvas.destroy(); setGuide([]); };
}
registerModule({ key: "sw", label: "Logiciel", icon: "code", tip: "Le logiciel embarqué du BMS, par objets reliés : l'outil en écrit le C — bibliothèque, modules, structure de fichiers — pour le CPU choisi", render });
