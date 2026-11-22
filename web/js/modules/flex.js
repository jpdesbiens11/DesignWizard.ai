/* DesignOrbit.ai — Circuits flexibles : a polyimide strip folded where the product asks, its tracks — one per function —
   and its sensors. Left, the strip, its legs and the functions it carries. In the view, the mouse says where a sensor sits :
   right click on a flat face lays a temperature probe or a voltage tap there, a click moves the chosen one, the arrows
   nudge it, V sends it to the other face, Delete removes it. Right, the sensors and every track with what it can carry.
   The definition goes to an AI and comes back with a preview of what changed. Route : #/flex/<part>. */

import { el, clear, icon, btn, badge, field, toast, fmt, fmtMass, inUnits, unitField, unitInput, unitLabel as unitLabelOf, debounce, modal, copyText, table } from "../core/dom.js";
import { registerModule, go, setStatus, setContext, setGuide, app } from "../core/app.js";
import { store } from "../core/store.js";
import { kernel } from "../cad/client.js";
import { createViewport, showBuilt } from "../core/viewport.js";
import { flatToggle } from "./flat_view.js";
import { importPart } from "../core/importer.js";
import { toDwiz } from "../core/dwiz.js";
import { aiRead, aiDiff } from "../core/ai_loop.js";
import { applyAnswer } from "./ai_loop.js";
import { CONNECTORS } from "../cad/elec_library.js";
import { WELD_PROCESSES } from "../cad/interfaces_elec.js";
import { locate } from "../core/busbar.js";
import { blankFlex, flexPart, flexChecks, addSensor, fitSensor, SENSOR_KINDS, TAIL_MATES, BEND_RATIO } from "../core/flex.js";
import { blankTree, exampleTree, treePart, isTree } from "../core/flex_tree.js";
import { renderTree, kindTiles } from "./flex_tree.js";

const KEYS = [["Clic droit sur une face", "Poser une sonde de température ou une prise de tension"], ["Clic sur une face", "Y déplacer le capteur choisi"], ["← → ↑ ↓", "Pousser le capteur de 1 mm (Maj : 5 mm · Alt : 0,1 mm)"], ["V", "L'envoyer sur l'autre face (verso)"], ["Tab · Suppr", "Capteur suivant · retirer le capteur choisi"]];
const fr = (x, d = 2) => fmt(x, d);
/** What goes to an AI : the definition alone, behind a short request ; the answer brings the definition back. */
const request = (spec) => ["Tu es l'assistant de conception de DesignOrbit.ai. Voici un circuit flexible : seul son bloc « flex » se modifie, la géométrie sera réécrite par la plateforme.",
  "ENTREVUE — pose-moi au plus cinq questions, une à la fois : quelles fonctions relier, quels courants, où mesurer une température ou une tension, comment le circuit se raccorde à la carte. Puis résume en trois lignes et attends mon accord.",
  "RÉPONSE ATTENDUE — un seul bloc ```dwiz avec la pièce entière, bloc « flex » à jour : « tracks » (net, fn, w en mm, i en A), « sensors » (id, kind temp ou volt, leg, side 1 ou -1, s, y, net), « legs » (L, bend 90 ou -90), W, t, r. Garde les identifiants des capteurs existants. Après le bloc, liste ce que tu as changé.",
  "", toDwiz(spec).trimEnd()].join("\n");

function render(main, args) {
  const list = store.parts.filter((p) => p.flex), id = args[0] && store.part(args[0]) && store.part(args[0]).flex ? args[0] : (list[0] && list[0].id) || null;
  const left = el("aside", { class: "side" }), right = el("aside", { class: "side right" }), view = el("div"), root = el("div", { class: "studio" }, left, view, right);
  root.style.setProperty("--left-w", "350px"); root.style.setProperty("--right-w", "400px");
  main.append(root);
  /* a new circuit : a folded strip, a core with branches, or the worked example with seven branches */
  const make = (kind) => { const nid = store.nextPartId(), r = importPart(kind === "strip" ? flexPart(blankFlex(), nid) : treePart(kind === "example" ? exampleTree() : blankTree(), nid), { replace: false }); if (r.errors && r.errors.length) { toast(r.errors.join(" "), "error"); return; } go(`#/flex/${encodeURIComponent(r.id)}`); };
  const create = () => { const m = modal("Nouveau circuit flexible", [el("p", { class: "muted" }, "Une bande que l'on plie, ou un cœur large d'où partent des branches vers les points à mesurer."), kindTiles((k) => { m.close(); make(k); })], { wide: true }); };
  if (app.pendingNew === "flex") { app.pendingNew = null; setTimeout(create, 0); }      // sent by the floor of the Shop : « new flex circuit »
  const head = () => el("div", { class: "side-head" }, el("h2", null, "Circuits flexibles"), btn("", create, { small: true, icon: "plus", tip: "Nouveau circuit flexible : bande pliée, circuit ramifié ou exemple" }));
  const listed = () => el("div", { class: "side-section" }, list.map((p) => el("a", { class: "nav-item" + (p.id === id ? " active" : ""), href: `#/flex/${encodeURIComponent(p.id)}` }, icon("chip"), el("span", { class: "grow" }, p.name || p.id), isTree(p.flex) ? badge("ramifié", "info") : null, el("small", null, p.id))));
  if (!id) {
    root.classList.add("no-right"); right.remove(); left.append(el("div", { class: "side-head" }, el("h2", null, "Circuits flexibles")));
    view.append(el("div", { class: "page" }, el("div", { class: "empty" }, el("h2", null, "Un circuit souple qui relie des fonctions"), el("p", null, "Une bande que l'on plie, avec ses sondes et ses prises posées à la souris — ou un cœur large, sous une carte rigide, d'où partent des branches vers les points à mesurer."), el("div", { style: { maxWidth: "640px", margin: "0 auto" } }, kindTiles(make)))));
    return null;
  }
  if (isTree(store.part(id).flex)) { root.style.setProperty("--right-w", "430px"); return renderTree({ id, left, right, view, head, list: listed }); }
  const st = { sel: null, token: 0, built: null }, def = () => store.part(id).flex;
  const rewrite = (x, d) => { const next = flexPart(d, id, x); for (const k of Object.keys(x)) if (k !== "id") delete x[k]; Object.assign(x, next); };
  const change = (label, fn) => store.updatePart(id, (x) => { const d = JSON.parse(JSON.stringify(x.flex)); fn(d); rewrite(x, d); }, label);
  const item = (d = def()) => d.sensors.find((x) => x.id === st.sel) || null;
  const edit = (label, fn) => change(label, (d) => { const x = d.sensors.find((q) => q.id === st.sel); if (x) { fn(x, d); fitSensor(d, x); } });
  const place = (w) => edit(`${st.sel} déplacé`, (x) => { x.leg = w.leg; x.side = w.side; x.s = w.s; x.y = w.y; });
  const menuFor = (h) => {
    const w = h && h.normal ? locate(def(), h.local || h.point, h.normal) : null;
    if (!w) return h ? [{ title: "Tranche, pli ou composant : un capteur se pose sur une face plane du film" }] : null;
    return [{ title: `Branche ${w.leg + 1} — à ${fr(w.s, 1)} mm du début` }, ...Object.entries(SENSOR_KINDS).map(([k, K]) => ({ label: `Poser une ${K.label.toLowerCase()} ici`, icon: k === "temp" ? "sensor" : "power", run: () => change(`${K.label} posée`, (d) => { st.sel = addSensor(d, k, w).id; }) })),
      ...(item() ? [{ label: `Déplacer ${st.sel} ici`, icon: "mate", run: () => place(w) }] : [])];
  };
  const onKey = (e) => {
    const x = item(), k = e.key, step = e.altKey ? 0.1 : e.shiftKey ? 5 : 1, all = def().sensors;
    if (k === "Tab" && all.length) { e.preventDefault(); st.sel = all[(all.findIndex((q) => q.id === st.sel) + 1) % all.length].id; mark(); renderRight(); return; }
    if (!x) return;
    const dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[k];
    if (dir) { e.preventDefault(); edit(`${x.id} poussé`, (q) => { q.s = Math.round((q.s + dir[0] * step) * 100) / 100; q.y = Math.round((q.y + dir[1] * step) * 100) / 100; }); }
    else if (k === "Delete" || k === "Backspace") { e.preventDefault(); const gone = x.id; st.sel = null; change(`${gone} retiré`, (d) => { d.sensors = d.sensors.filter((q) => q.id !== gone); }); }
    else if (k.toLowerCase() === "v") edit(`${x.id} sur l'autre face`, (q) => { q.side = -q.side; });
  };
  const vp = createViewport(view, { name: () => id, explode: false, select: false, menuFor, onKey, keys: KEYS,
    onPick: (h) => { const w = h && h.normal ? locate(def(), h.local || h.point, h.normal) : null; if (w && item()) place(w); else if (w) toast("Clic droit pour poser un capteur ici ; choisissez-en un à droite pour le déplacer d'un clic.", "info", 4000); return true; } });
  const info = el("span", { class: "chip" }, "—"), verdict = el("span", { class: "chip" }, "");
  vp.setStatus(info, verdict);
  const flat = flatToggle(vp, { spec: () => store.part(id), built: () => st.built, tags: ["fx"], repaint: () => { vp.viewer.clear(); if (st.built) showBuilt(vp.viewer, st.built, { prefix: "fx" }); mark(); } });
  function mark() { const v = vp.viewer; v.clearOverlays("fx"); if (!st.built || flat.on()) return; for (const it of st.built.interfaces) { const on = it.id === st.sel; v.addLabel(it.frame.o, it.id === "IF1" ? "Queue" : it.id, "fx", on ? "iface" : "label"); if (on) v.addMarker(it.frame.o, "#ff8a3d", "fx", 1.2); } }
  async function build(first) {
    const token = ++st.token, spec = store.part(id);
    try {
      const built = await kernel.build(spec); if (token !== st.token) return;
      st.built = built; setContext({ spec, built });
      if (flat.on()) flat.refresh(); else { vp.viewer.clear(); showBuilt(vp.viewer, built, { prefix: "fx" }); if (first) vp.viewer.view("iso"); mark(); flat.sync(); }
      const c = flexChecks(spec.flex), errs = built.log.filter((l) => l.level === "error"), bad = c.notes.filter((n) => n.level === "bad").length, chk = c.notes.filter((n) => n.level === "check").length;
      info.textContent = `${inUnits(`${c.rows.length} pistes sur ${fr(c.used, 1)} mm de ${fr(spec.flex.W, 1)} mm · ${fr(c.length, 0)} mm`)} · ${spec.flex.sensors.length} capteur(s) · ${fmtMass(built.mass)}`;
      verdict.textContent = errs.length ? "ne se construit pas" : bad ? `${bad} à corriger` : chk ? `${chk} à vérifier` : "dans les règles"; verdict.className = `chip ${errs.length || bad ? "bad" : chk ? "warn" : "done"}`; verdict.dataset.tip = [...errs.map((e) => e.msg), ...c.notes.map((n) => n.text)].join(" · ") || "Pistes, plis et queue suivent les règles du métier";
      setStatus(`${id} construit`, "done");
    } catch (e) { if (token === st.token) { info.textContent = e.message; info.className = "chip bad"; } }
  }
  /* the round trip with an AI : the definition goes out with a short request ; what comes back is shown before it is applied, in one undoable step */
  function reimport() {
    const area = el("textarea", { rows: 9, placeholder: "Collez la réponse de l'assistant : elle contient la pièce dans un bloc ```dwiz." }), out = el("div"); let next = null;
    const ok = btn("Appliquer ces changements", () => { if (!next) return; applyAnswer([`part:${id}`], `Circuit flexible ${id} réimporté depuis une IA`, () => store.updatePart(id, (x) => rewrite(x, next), `${id} : circuit mis à jour par l'IA`)); m.close(); toast("Circuit réécrit depuis la définition revenue de l'IA.", "success"); }, { primary: true, icon: "check", disabled: true });
    area.addEventListener("input", () => { next = null; ok.disabled = true; out.replaceChildren(); if (!area.value.trim()) return;
      try { const doc = aiRead(area.value); if (!doc || !doc.flex) throw new Error("La réponse ne contient pas de bloc « flex »."); const d = { ...blankFlex(), ...doc.flex }, c = flexChecks(d), diff = aiDiff(def(), d);
        out.append(el("p", null, diff.length ? `${diff.length} changement(s) :` : "Aucun changement dans la définition."), el("ul", { class: "decisions" }, diff.slice(0, 30).map((x) => el("li", null, `${x.path} — ${x.text}`))), ...c.notes.map((n) => el("p", { class: n.level === "bad" ? "form-error" : "atelier-hint", style: { fontSize: ".82rem" } }, n.text)));
        if (diff.length) { next = d; ok.disabled = false; }
      } catch (e) { out.append(el("p", { class: "form-error" }, e.message)); } });
    const m = modal(`Réimporter ${id} depuis une IA`, [field("Réponse de l'assistant", area), out, el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), ok)], { wide: true });
  }
  function renderLeft() {
    clear(left); const d = def(), slow = debounce((label, fn) => change(label, fn), 350);
    const num = (key, label, step = 0.5, min = 0.01) => unitField(label, { value: d[key], step, min }, (v) => { if (v >= min) slow(`Circuit : ${label}`, (x) => { x[key] = v; }); });
    left.append(head());
    const scroll = el("div", { class: "side-scroll" }); left.append(scroll);
    scroll.append(listed());
    scroll.append(el("div", { class: "side-section" }, el("h3", null, "La bande"), field("Nom", el("input", { type: "text", value: d.name, onChange: (e) => change("Circuit : nom", (x) => { x.name = e.target.value; }) })),
      el("div", { class: "form-row" }, num("W", "Largeur"), num("t", "Épaisseur", 0.05), d.legs.length > 1 ? num("r", "Rayon de pli", 0.5) : null),
      el("div", { class: "form-row" }, field("Cuivre", el("select", { onChange: (e) => change("Circuit : cuivre", (x) => { x.cu = +e.target.value; }) }, [[0.018, "18 µm"], [0.035, "35 µm"], [0.07, "70 µm"]].map(([v, l]) => el("option", { value: v, selected: v === d.cu }, l)))),
        field("Faces", el("select", { "data-tip": `Rayon de pli au moins ${BEND_RATIO[1]} × l'épaisseur en simple face, ${BEND_RATIO[2]} × en double face`, onChange: (e) => change("Circuit : faces", (x) => { x.layers = +e.target.value; }) }, [[1, "Simple face"], [2, "Double face"]].map(([v, l]) => el("option", { value: v, selected: v === d.layers }, l)))), num("gap", "Espace entre pistes", 0.05)),
      el("div", { class: "form-row" }, field("Raccordement à la carte", el("select", { onChange: (e) => change("Circuit : raccordement", (x) => { x.tail = { ...(x.tail || {}), mate: e.target.value }; }) }, Object.entries(TAIL_MATES).map(([k, l]) => el("option", { value: k, selected: k === (d.tail || {}).mate }, l)))),
        (d.tail || {}).mate === "zif" ? field("Connecteur", el("select", { onChange: (e) => change("Circuit : connecteur", (x) => { x.tail.ref = e.target.value; }) }, CONNECTORS.filter((c) => c.kind === "ffc" || c.kind === "board-to-board").map((c) => el("option", { value: c.id, selected: c.id === d.tail.ref }, `${c.maker} ${c.series}`)))) : null)));
    scroll.append(el("div", { class: "side-section" }, el("h3", null, el("span", { class: "grow" }, `Branches (${d.legs.length})`), btn("", () => change("Branche ajoutée", (x) => { x.legs.push({ L: 30, bend: 90 }); }), { small: true, icon: "plus", tip: "Ajouter une branche après un pli à 90°" })),
      d.legs.map((g, i) => el("div", { class: "param", style: { gridTemplateColumns: "22px minmax(0,1fr) 108px auto", alignItems: "center" } }, badge(String(i + 1), "neutral"),
        unitInput("Longueur", { value: g.L, step: 1, min: 3, "aria-label": `Longueur de la branche ${i + 1}` }, (v) => { if (v >= 3) slow(`Branche ${i + 1}`, (x) => { x.legs[i].L = v; }); }).input,
        i ? el("select", { "aria-label": `Pli avant la branche ${i + 1}`, onChange: (e) => change(`Pli ${i}`, (x) => { x.legs[i].bend = +e.target.value; }) }, [[90, "pli vers le haut"], [-90, "pli vers le bas"]].map(([v, l]) => el("option", { value: v, selected: v === (g.bend || 90) }, l))) : el("small", { class: "muted" }, "la queue, à plat"),
        d.legs.length > 1 ? el("button", { class: "icon-btn", type: "button", "aria-label": `Retirer la branche ${i + 1}`, onClick: () => change(`Branche ${i + 1} retirée`, (x) => { x.legs.splice(i, 1); if (x.legs[0]) delete x.legs[0].bend; x.sensors = x.sensors.filter((q) => q.leg !== i).map((q) => ({ ...q, leg: q.leg > i ? q.leg - 1 : q.leg })); }) }, "×") : el("span")))));
    scroll.append(el("div", { class: "side-section" }, el("h3", null, el("span", { class: "grow" }, `Fonctions à relier (${d.tracks.length})`), btn("", () => change("Fonction ajoutée", (x) => { x.tracks.push({ net: `NET${x.tracks.length + 1}`, fn: "", w: 0.3, i: 0.1 }); }), { small: true, icon: "plus", tip: "Une piste de plus, pour une fonction de plus" })),
      d.tracks.map((t, k) => el("div", { class: "param", style: { gridTemplateColumns: "76px minmax(0,1fr) 58px 58px auto", alignItems: "center", gap: ".25rem" } },
        el("input", { type: "text", value: t.net, "aria-label": "Potentiel ou signal", "data-tip": "Le signal ou le potentiel : 5V, GND, CAN-H, RS485-A…", onChange: (e) => change("Piste : signal", (x) => { x.tracks[k].net = e.target.value.trim() || `NET${k + 1}`; }) }),
        el("input", { type: "text", value: t.fn || "", placeholder: "À quoi elle sert", "aria-label": "Fonction", onChange: (e) => change("Piste : fonction", (x) => { x.tracks[k].fn = e.target.value; }) }),
        unitInput("Largeur", { value: t.w, step: 0.05, min: 0.1, "aria-label": "Largeur de piste", "data-tip": unitLabelOf("Largeur de la piste (mm)") }, (v) => { if (v > 0) change("Piste : largeur", (x) => { x.tracks[k].w = v; }); }, { event: "onChange" }).input,
        el("input", { type: "number", value: t.i, step: 0.05, min: 0, "aria-label": "Courant", "data-tip": "Courant à porter (A)", onChange: (e) => { const v = parseFloat(e.target.value); if (v >= 0) change("Piste : courant", (x) => { x.tracks[k].i = v; }); } }),
        el("button", { class: "icon-btn", type: "button", "aria-label": `Retirer la piste ${t.net}`, onClick: () => change("Fonction retirée", (x) => { x.tracks.splice(k, 1); }) }, "×"))),
      el("p", { class: "muted", style: { fontSize: ".78rem" } }, "Signal · fonction · largeur (mm) · courant (A). Les pistes des capteurs s'ajoutent seules.")));
    const c = flexChecks(d);
    if (c.notes.length) scroll.append(el("div", { class: "side-section" }, el("h3", null, "À regarder"), c.notes.map((n) => el("p", { class: n.level === "bad" ? "form-error" : "atelier-hint warn", style: { fontSize: ".82rem" } }, n.text))));
    scroll.append(el("div", { class: "side-section" }, el("h3", null, "Avec une IA"), el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } },
      btn("Copier pour une IA", async () => toast((await copyText(request(store.part(id)))) ? "Copié : la définition du circuit et sa consigne." : "Copie impossible.", "success", 5000), { small: true, icon: "sparkle", tip: "La définition du circuit, précédée de la façon de mener l'entrevue et de la réponse attendue" }),
      btn("Réimporter…", reimport, { small: true, icon: "wizard", tip: "Aperçu des changements, puis une seule étape annulable" }))));
  }
  function renderRight() {
    clear(right); const d = def(), c = flexChecks(d);
    setGuide(c.notes.map((n) => ({ level: n.level === "bad" ? "error" : "warn", text: n.text })));      // the guide of the top bar says what the left pane says
    right.append(el("div", { class: "side-head" }, el("h2", null, "Capteurs et pistes"), el("a", { class: "btn btn-small", href: `#/parts/${encodeURIComponent(id)}`, "data-tip": "Ouvrir dans le studio de pièce" }, icon("part"))));
    const body = el("div", { class: "side-scroll" }); right.append(body);
    if (!d.sensors.length) body.append(el("p", { class: "atelier-hint" }, icon("info"), " Clic droit sur une face plane du film : « Poser une sonde de température ici » ou « Poser une prise de tension ici »."));
    for (const x of d.sensors) {
      const on = x.id === st.sel, K = SENSOR_KINDS[x.kind], set = (label, fn) => { st.sel = x.id; edit(`${x.id} : ${label}`, fn); };
      const card = el("div", { class: "card" + (on ? " taped" : ""), style: { padding: ".55rem .7rem", marginBottom: ".5rem", cursor: "pointer" }, "data-conn": x.id, onClick: (e) => { if (/^(INPUT|SELECT|BUTTON|LABEL)$/.test(e.target.tagName)) return; st.sel = on ? null : x.id; mark(); renderRight(); } },
        el("div", { style: { display: "flex", gap: ".4rem", alignItems: "center", flexWrap: "wrap" } }, el("b", null, x.id), badge(K.label, x.kind === "temp" ? "info" : "warn"), el("small", { class: "muted" }, `branche ${x.leg + 1} · à ${fr(x.s, 1)} mm · ${x.side > 0 ? "recto" : "verso"}`)));
      if (on) { card.append(el("p", { class: "muted", style: { fontSize: ".78rem", margin: ".25rem 0" } }, K.text + "."),
        el("div", { class: "form-row tight" }, x.kind === "volt" ? field("Potentiel ramené", el("input", { type: "text", value: x.net || "", placeholder: "S1+, HV−…", onChange: (e) => set("potentiel", (q) => { q.net = e.target.value.trim(); }) })) : null,
          x.kind === "volt" ? field("Liaison", el("select", { onChange: (e) => set("liaison", (q) => { q.process = e.target.value; }) }, Object.entries(WELD_PROCESSES).filter(([k]) => k !== "wirebond").map(([k, w]) => el("option", { value: k, selected: k === (x.process || "laser") }, w.label)))) : null,
          field("Posé sur", el("input", { type: "text", value: x.on || "", placeholder: x.kind === "temp" ? "Cellule, busbar, dissipateur…" : "Busbar, borne de cellule…", onChange: (e) => set("posé sur", (q) => { q.on = e.target.value; }) }))),
        el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, btn("Autre face", () => set("autre face", (q) => { q.side = -q.side; }), { small: true, icon: "layers", tip: "Verso (V)" }), btn("Retirer", () => { const gone = x.id; st.sel = null; change(`${gone} retiré`, (q) => { q.sensors = q.sensors.filter((k) => k.id !== gone); }); }, { small: true, icon: "trash", danger: true }))); }
      body.append(card);
    }
    body.append(el("div", { class: "side-section" }, el("h3", null, `Pistes (${c.rows.length})`), table(["", "Signal", "Fonction", "mm", "A", "A adm."], c.rows.map((t) => [t.id, t.net, t.fn || "—", fr(t.w), fr(t.i || 0), el("span", { class: t.ok ? "" : "form-error" }, fr(t.amps))])),
      el("p", { class: "muted", style: { fontSize: ".78rem" } }, `Courant admissible : IPC-2221, piste couverte, échauffement de 20 K. Queue : ${c.pins} contacts${c.pitch ? ` au pas de ${fr(c.pitch)} mm` : ""}.`)));
    body.append(el("div", { class: "side-section" }, el("h3", null, "À la souris et au clavier"), el("table", { class: "data" }, el("tbody", null, KEYS.map(([k, t]) => el("tr", null, el("td", null, el("kbd", null, k)), el("td", { style: { fontSize: ".8rem" } }, t)))))));
  }
  const off = store.on("change", () => { const p = store.part(id); if (!p || !p.flex) { go("#/flex"); return; } if (isTree(p.flex)) { go(`#/flex/${encodeURIComponent(id)}`); return; } renderLeft(); renderRight(); build(); });
  renderLeft(); renderRight(); build(true);
  return () => { off(); st.token++; setGuide([]); };
}

registerModule({ key: "flex", label: "Circuits flexibles", icon: "chip", tip: "Circuits flexibles : une bande souple pliée et ses capteurs posés à la souris, ou un cœur large sous une carte rigide, d'où partent des branches vers les points à mesurer", render });
