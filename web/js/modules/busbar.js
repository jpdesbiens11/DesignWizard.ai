/* DesignWizard.ai — Busbars : a solid conductor cut and folded from sheet, with its terminals and its lamella contacts.
   Left, the strip : material, potential, current, width, thickness, and its legs, each after a bend. In the view, the mouse
   says WHERE : a right click on a flat face lays a contact or a terminal there ; a click moves the chosen one ; the arrows
   nudge it, R turns it, V sends it to the other face, + and − change its points, Delete removes it. Right, each connection
   with its number (T1, CT1…), its drop-down choices and what it is worth. Route : #/busbar/<part>. */

import { el, clear, icon, btn, badge, field, toast, fmt, fmtMass, debounce } from "../core/dom.js";
import { registerModule, go, setStatus, setContext } from "../core/app.js";
import { store } from "../core/store.js";
import { kernel } from "../cad/client.js";
import { createViewport, showBuilt } from "../core/viewport.js";
import { importPart } from "../core/importer.js";
import { materialMenu, materialLabel } from "../cad/materials.js";
import { THREADS } from "../cad/standards.js";
import { PLATINGS, CONTACT_BASES, CONTACT_TESTS, CONTACT_FORMS, contactEstimate, contactForm, contactFormNotes } from "../cad/interfaces_elec.js";
import { contactFormPicker, FORM_COLOR } from "./contact_forms.js";
import { blankBusbar, busbarPart, busbarChecks, legsOf, locate, addContact, addTerminal, fit, FINISHES, INSULATIONS, contactParams } from "../core/busbar.js";
import { blankLaminate, blankLamFlex, laminatePart, laminateChecks, PAPER_THICKNESS } from "../core/busbar_lam.js";
import { modal } from "../core/dom.js";

/** A laminated busbar is asked for in one dialog : the stack, the paper, the film, the tabs — and what the stack is worth before it is created. */
function newLaminate() {
  const d = blankLaminate(), fx = blankLamFlex(), out = el("div"), nets = el("input", { type: "text", value: d.layers.map((l) => l.net).join(", ") });
  /* the measuring circuit : where it lies in the stack — the choices follow the potentials typed above */
  const where = el("select", { "aria-label": "Circuit de mesure", onChange: (e) => { const k = +e.target.value; if (k) fx.after = k; d.flex = k ? fx : null; check(); } });
  const places = () => { if (d.flex && d.flex.after >= d.layers.length) { if (d.layers.length > 1) fx.after = d.layers.length - 1; else d.flex = null; }
    where.replaceChildren(el("option", { value: "", selected: !d.flex }, "Sans"), ...d.layers.slice(0, -1).map((l, i) => el("option", { value: i + 1, selected: !!d.flex && fx.after === i + 1 }, `Entre ${l.net} et ${d.layers[i + 1].net}`))); };
  const check = () => { d.layers = nets.value.split(",").map((x) => x.trim()).filter(Boolean).map((net) => ({ net, t: d.layers[0] ? d.layers[0].t : 1.5 })); places(); const c = laminateChecks(d);
    out.replaceChildren(el("p", { class: "muted small" }, c.rows.map((r) => `${r.net} : ${fmt(r.S, 1)} mm², ${fmt(r.J)} A/mm²`).join(" · "), ` · pattes de ${fmt(c.tabW, 1)} mm · papier ≈ ${fmt(c.withstand / 1000, 1)} kV pour un essai de ${fmt(c.test / 1000, 1)} kV`, c.flex ? ` · circuit de mesure : ${c.flex.pins} pistes (${c.flex.tracks.map((t) => t.net).join(", ")}), couverture ≈ ${fmt(c.flex.hold / 1000, 1)} kV` : ""), ...c.notes.map((n) => el("p", { class: n.level === "bad" ? "form-error" : "atelier-hint", style: { fontSize: ".82rem" } }, n.text))); ok.disabled = !c.ok; };
  const num = (obj, key, label, step = 1) => field(label, el("input", { type: "number", value: obj[key], step, min: 0, onInput: (e) => { const v = parseFloat(e.target.value); if (v > 0) { if (key === "t" && obj === d.layers[0]) d.layers.forEach((l) => { l.t = v; }); else obj[key] = v; check(); } } }));
  const ok = btn("Créer le busbar laminé", () => { const r = importPart(laminatePart(d, store.nextPartId()), { replace: false }); if (r.errors && r.errors.length) { toast(r.errors.join(" "), "error"); return; } m.close(); toast(`${r.id} créé : une couche par corps, à voir dans le studio de pièce et dans l'écran Isolation.`, "success", 6000); go(`#/parts/${encodeURIComponent(r.id)}`); }, { primary: true, icon: "plus" });
  nets.addEventListener("input", check);
  const m = modal("Busbar laminé", [el("p", { class: "muted" }, "Des conducteurs de potentiels opposés posés l'un sur l'autre, un papier aramide entre eux sur toute l'épaisseur, un film polymère autour. L'isolant déborde les conducteurs : c'est la ligne de fuite. Il peut porter son propre circuit de mesure, pris entre deux plaques."),
    el("div", { class: "form-row" }, field("Potentiels, du bas vers le haut", nets, "Séparés par des virgules : HV+, HV−"), num(d.layers[0], "t", "Épaisseur d'un conducteur", 0.1), num(d, "I", "Courant par conducteur (A)"), num(d, "U", "Tension entre voisins (V)")),
    el("div", { class: "form-row" }, num(d, "L", "Longueur"), num(d, "W", "Largeur"), num(d, "e", "Débord de l'isolant", 0.5), field("Papier aramide", el("select", { onChange: (e) => { d.paper.t = +e.target.value; check(); } }, PAPER_THICKNESS.map((t) => el("option", { value: t, selected: t === d.paper.t }, `${String(t).replace(".", ",")} mm`))))),
    el("div", { class: "form-row" }, field("Enveloppe", el("select", { onChange: (e) => { d.wrap = e.target.value ? { material: e.target.value, t: e.target.value === "PI-FILM" ? 0.1 : 0.19 } : null; check(); } }, [["PET-FILM", "Film polyester 0,19 mm"], ["PI-FILM", "Film polyimide 0,1 mm"], ["", "Sans enveloppe"]].map(([k, l]) => el("option", { value: k, selected: k === (d.wrap ? d.wrap.material : "") }, l)))),
      num(d.tab, "L", "Longueur des pattes"), num(d.tab, "gap", "Écart entre pattes"), field("Vis des pattes", el("select", { onChange: (e) => { d.tab.screw = e.target.value; check(); } }, ["M4", "M5", "M6", "M8", "M10"].map((k) => el("option", { value: k, selected: k === d.tab.screw }, k))))),
    el("div", { class: "form-row" }, field("Circuit de mesure", where, "Un circuit flexible dans une fente du papier : une prise de tension sur chacune des deux plaques, des sondes au cœur, une queue qui sort par le côté"),
      field("Sondes de température", el("select", { "aria-label": "Sondes de température", onChange: (e) => { fx.ntc = +e.target.value; check(); } }, [0, 1, 2, 3].map((k) => el("option", { value: k, selected: k === fx.ntc }, String(k))))), num(fx, "W", "Largeur du circuit", 0.5), num(fx.tail, "L", "Longueur de la queue")),
    out, el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), ok)], { wide: true });
  check();
}

const KEYS = [["Clic droit sur une face", "Poser un contact ou une borne à cet endroit"], ["Clic sur une face", "Y déplacer le raccordement choisi"], ["← → ↑ ↓", "Pousser le raccordement de 1 mm (Maj : 5 mm · Alt : 0,1 mm)"],
  ["R · V", "Tourner le contact d'un quart de tour · l'envoyer sur l'autre face (verso)"], ["+ · −", "Un point de contact de plus, de moins"], ["Tab", "Raccordement suivant"], ["Suppr", "Retirer le raccordement choisi"]];
const fr = (x, d = 2) => fmt(x, d);

function render(main, args) {
  const bars = store.parts.filter((p) => p.busbar), id = args[0] && store.part(args[0]) && store.part(args[0]).busbar ? args[0] : (bars[0] && bars[0].id) || null;
  const left = el("aside", { class: "side" }), right = el("aside", { class: "side right" }), view = el("div"), root = el("div", { class: "studio" }, left, view, right);
  root.style.setProperty("--left-w", "340px"); root.style.setProperty("--right-w", "380px");
  main.append(root);
  const create = () => { const r = importPart(busbarPart(blankBusbar(), store.nextPartId()), { replace: false }); if (r.errors && r.errors.length) { toast(r.errors.join(" "), "error"); return; } go(`#/busbar/${encodeURIComponent(r.id)}`); };
  if (!id) {
    root.classList.add("no-right"); right.remove();
    left.append(el("div", { class: "side-head" }, el("h2", null, "Busbars")));
    view.append(el("div", { class: "page" }, el("div", { class: "empty" }, el("h2", null, "Un conducteur massif, plié et poinçonné"), el("p", null, "Donnez la bande et ses branches ; posez à la souris les bornes et les contacts à lamelles sur ses faces planes."),
      el("div", { class: "form-actions", style: { justifyContent: "center" } }, btn("Nouveau busbar", create, { primary: true, icon: "plus" }), btn("Busbar laminé…", newLaminate, { icon: "layers", tip: "Conducteurs empilés, papier aramide entre eux, film autour" })))));
    return null;
  }
  const st = { sel: null, token: 0, built: null }, def = () => store.part(id).busbar;
  /* every change writes the part again from its definition, in one undoable step */
  const change = (label, fn) => store.updatePart(id, (x) => { const d = JSON.parse(JSON.stringify(x.busbar)); fn(d); const next = busbarPart(d, id, x); for (const k of Object.keys(x)) if (k !== "id") delete x[k]; Object.assign(x, next); }, label);
  const item = (d = def()) => [...d.terminals, ...d.contacts].find((x) => x.id === st.sel) || null, isContact = (x) => /^CT/.test(x.id);
  const edit = (label, fn) => change(label, (d) => { const x = [...d.terminals, ...d.contacts].find((q) => q.id === st.sel); if (!x) return; fn(x, d); if (isContact(x)) fit(d, x); else { const g = legsOf(d)[x.leg]; if (g) x.s = Math.max(g.from, Math.min(g.to, x.s)); } });
  const place = (w) => edit(`${st.sel} déplacé`, (x) => { x.leg = w.leg; x.s = w.s; if (isContact(x)) { x.side = w.side; x.y = w.y; } });
  const menuFor = (h) => {
    const w = h && h.normal ? locate(def(), h.local || h.point, h.normal) : null;
    if (!w) return h ? [{ title: "Tranche ou pli : un raccordement se pose sur une face plane" }] : null;
    return [{ title: `Branche ${w.leg + 1} — à ${fr(w.s, 1)} mm du début` }, { label: "Poser un contact à pression ici", icon: "power", run: () => change("Contact à pression posé", (d) => { st.sel = addContact(d, w).id; }) },      // chosen before the screen redraws
      { label: "Poser une borne vissée ici", icon: "bolt", run: () => change("Borne posée", (d) => { st.sel = addTerminal(d, w).id; }) }, ...(item() ? [{ label: `Déplacer ${st.sel} ici`, icon: "mate", run: () => place(w) }] : [])];
  };
  const onKey = (e) => {
    const x = item(), k = e.key, step = e.altKey ? 0.1 : e.shiftKey ? 5 : 1, all = [...def().terminals, ...def().contacts];
    if (k === "Tab" && all.length) { e.preventDefault(); st.sel = all[(all.findIndex((q) => q.id === st.sel) + 1) % all.length].id; mark(); renderRight(); return; }
    if (!x) return;
    const dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[k];
    if (dir) { e.preventDefault(); edit(`${x.id} poussé`, (q) => { q.s = Math.round((q.s + dir[0] * step) * 100) / 100; if (isContact(q)) q.y = Math.round((q.y + dir[1] * step) * 100) / 100; }); }
    else if (k === "Delete" || k === "Backspace") { e.preventDefault(); const gone = x.id; st.sel = null; change(`${gone} retiré`, (d) => { d.terminals = d.terminals.filter((q) => q.id !== gone); d.contacts = d.contacts.filter((q) => q.id !== gone); }); }
    else if (!isContact(x)) return;
    else if (k.toLowerCase() === "r") edit(`${x.id} tourné`, (q) => { q.turn = q.turn ? 0 : 1; });
    else if (k.toLowerCase() === "v") edit(`${x.id} sur l'autre face`, (q) => { q.side = -q.side; });
    else if (k === "+" || k === "=") edit(`${x.id} : un point de plus`, (q) => { q.n = Math.min(24, q.n + 1); });
    else if (k === "-") edit(`${x.id} : un point de moins`, (q) => { q.n = Math.max(1, q.n - 1); });
  };
  const vp = createViewport(view, { name: () => id, explode: false, select: false, menuFor, onKey, keys: KEYS,
    onPick: (h) => { const w = h && h.normal ? locate(def(), h.local || h.point, h.normal) : null; if (w && item()) place(w); else if (w) toast("Clic droit pour poser un contact ou une borne ici ; choisissez un raccordement à droite pour le déplacer d'un clic.", "info", 4500); return true; } });
  const info = el("span", { class: "chip" }, "—"), verdict = el("span", { class: "chip" }, "");
  vp.setStatus(info, verdict);
  function mark() {
    const v = vp.viewer; v.clearOverlays("bb"); if (!st.built) return;
    for (const it of st.built.interfaces) { const on = it.id === st.sel; v.addLabel(it.frame.o, it.id, "bb", on ? "iface" : "label"); if (on) v.addMarker(it.frame.o, "#ff8a3d", "bb", 1.4); }
  }
  async function build(first) {
    const token = ++st.token, spec = store.part(id);
    try {
      const built = await kernel.build(spec); if (token !== st.token) return;
      st.built = built; setContext({ spec, built }); vp.viewer.clear(); showBuilt(vp.viewer, built, { prefix: "bb" }); if (first) vp.viewer.view("iso"); mark();
      const c = busbarChecks(spec.busbar), errs = built.log.filter((l) => l.level === "error"), bad = c.notes.filter((n) => n.level === "bad").length, chk = c.notes.filter((n) => n.level === "check").length;
      info.textContent = `${fr(c.S, 1)} mm² · ${fr(c.J)} A/mm² · ${fr(c.length, 1)} mm${c.bends ? ` · développé ≈ ${fr(c.flat, 1)} mm` : ""} · ${fmtMass(built.mass)}`;
      verdict.textContent = errs.length ? "ne se construit pas" : bad ? `${bad} à corriger` : chk ? `${chk} à vérifier` : "dans les règles"; verdict.className = `chip ${errs.length || bad ? "bad" : chk ? "warn" : "done"}`; verdict.dataset.tip = [...errs.map((e) => e.msg), ...c.notes.map((n) => n.text)].join(" · ") || "Section, pliage, bornes et contacts suivent les règles du métier";
      setStatus(`${id} construit`, "done");
    } catch (e) { if (token === st.token) { info.textContent = e.message; info.className = "chip bad"; } }
  }
  function renderLeft() {
    clear(left); const d = def(), slow = debounce((label, fn) => change(label, fn), 350);
    const num = (key, label, step = 0.5, min = 0.1) => field(label, el("input", { type: "number", value: d[key], step, min, onInput: (e) => { const v = parseFloat(e.target.value); if (v >= min) slow(`Busbar : ${label}`, (x) => { x[key] = v; }); } }));
    left.append(el("div", { class: "side-head" }, el("h2", null, "Busbars"), btn("", newLaminate, { small: true, icon: "layers", tip: "Busbar laminé : conducteurs empilés, papier aramide, film" }), btn("", create, { small: true, icon: "plus", tip: "Nouveau busbar plié" })));
    const scroll = el("div", { class: "side-scroll" }); left.append(scroll);
    scroll.append(el("div", { class: "side-section" }, bars.map((p) => el("a", { class: "nav-item" + (p.id === id ? " active" : ""), href: `#/busbar/${encodeURIComponent(p.id)}` }, icon("power"), el("span", { class: "grow" }, p.name || p.id), el("small", null, `${p.id} · ${(p.elec || {}).net || ""}`)))));
    scroll.append(el("div", { class: "side-section" }, el("h3", null, "La bande"), field("Nom", el("input", { type: "text", value: d.name, onChange: (e) => change("Busbar : nom", (x) => { x.name = e.target.value; }) })),
      el("div", { class: "form-row" }, field("Matière", el("select", { onChange: (e) => change("Busbar : matière", (x) => { x.material = e.target.value; }) }, materialMenu((m) => m.conductive && m.cls === "metal").map((f) => el("optgroup", { label: f.family }, f.list.map((m) => el("option", { value: m.id, selected: m.id === d.material }, materialLabel(m))))))),
        field("Revêtement", el("select", { onChange: (e) => change("Busbar : revêtement", (x) => { x.finish = e.target.value; }) }, Object.entries(FINISHES).map(([k, l]) => el("option", { value: k, selected: k === (d.finish || "none") }, l))))),
      el("div", { class: "form-row" }, field("Potentiel", el("input", { type: "text", value: d.net, onChange: (e) => change("Busbar : potentiel", (x) => { x.net = e.target.value.trim() || "HV+"; }) }), "HV+, HV−, 48V, RS485-A…"), num("I", "Courant (A)", 1, 0)),
      el("div", { class: "form-row" }, num("W", "Largeur"), num("t", "Épaisseur", 0.1), d.legs.length > 1 ? num("r", "Rayon de pli", 0.5) : null),
      field("Isolant", el("select", { "data-tip": "Une gaine autour de la barre, ouverte par une fenêtre à chaque borne et à chaque contact", onChange: (e) => change("Busbar : isolant", (x) => { if (e.target.value) x.insulation = { material: e.target.value, t: INSULATIONS[e.target.value].t }; else delete x.insulation; }) },
        [["", "Aucun : barre nue"], ...Object.entries(INSULATIONS).map(([k, v]) => [k, `${v.fr} — ${String(v.t).replace(".", ",")} mm, fenêtres aux raccordements`])].map(([k, l]) => el("option", { value: k, selected: k === ((d.insulation || {}).material || "") }, l))))));
    scroll.append(el("div", { class: "side-section" }, el("h3", null, el("span", { class: "grow" }, `Branches (${d.legs.length})`), btn("", () => change("Branche ajoutée", (x) => { x.legs.push({ L: 40, bend: 90 }); }), { small: true, icon: "plus", tip: "Ajouter une branche après un pli à 90°" })),
      d.legs.map((g, i) => el("div", { class: "param", style: { gridTemplateColumns: "22px minmax(0,1fr) 108px auto", alignItems: "center" } }, badge(String(i + 1), "neutral"),
        el("input", { type: "number", value: g.L, step: 1, min: 5, "aria-label": `Longueur de la branche ${i + 1}`, onInput: (e) => { const v = parseFloat(e.target.value); if (v >= 5) slow(`Branche ${i + 1}`, (x) => { x.legs[i].L = v; }); } }),
        i ? el("select", { "aria-label": `Pli avant la branche ${i + 1}`, onChange: (e) => change(`Pli ${i}`, (x) => { x.legs[i].bend = +e.target.value; }) }, [[90, "pli vers le haut"], [-90, "pli vers le bas"]].map(([v, l]) => el("option", { value: v, selected: v === (g.bend || 90) }, l))) : el("small", { class: "muted" }, "départ, à plat"),
        d.legs.length > 1 ? el("button", { class: "icon-btn", type: "button", "aria-label": `Retirer la branche ${i + 1}`, onClick: () => change(`Branche ${i + 1} retirée`, (x) => { x.legs.splice(i, 1); if (x.legs[0]) delete x.legs[0].bend; x.terminals = x.terminals.filter((q) => q.leg !== i).map((q) => ({ ...q, leg: q.leg > i ? q.leg - 1 : q.leg })); x.contacts = x.contacts.filter((q) => q.leg !== i).map((q) => ({ ...q, leg: q.leg > i ? q.leg - 1 : q.leg })); }) }, "×") : el("span"))),
      el("p", { class: "muted", style: { fontSize: ".78rem" } }, "Longueurs prises sur la fibre du milieu, d'un sommet de pli au suivant. La bande se découpe à plat, se poinçonne, puis se plie.")));
    const c = busbarChecks(d);
    if (c.notes.length) scroll.append(el("div", { class: "side-section" }, el("h3", null, "À regarder"), c.notes.map((n) => el("p", { class: n.level === "bad" ? "form-error" : "atelier-hint warn", style: { fontSize: ".82rem" } }, n.text))));
    scroll.append(el("div", { class: "side-section" }, el("p", { class: "muted", style: { fontSize: ".78rem" } }, `Résistance à 20 °C ≈ ${fr(c.R, 1)} µΩ · pertes ≈ ${fr(c.P)} W · chute ≈ ${fr(c.dU)} mV à ${fr(d.I || 0, 0)} A. `), el("a", { class: "btn btn-small", href: `#/physics/busbar/${encodeURIComponent(id)}`, "data-tip": "Ouvre le calcul d'échauffement avec la bande, le courant, la finition et la matière de ce busbar déjà entrés" }, icon("power"), "Vérifier l'échauffement")));
  }
  function renderRight() {
    clear(right); const d = def(), all = [...d.terminals, ...d.contacts];
    right.append(el("div", { class: "side-head" }, el("h2", null, "Raccordements"), el("a", { class: "btn btn-small", href: `#/parts/${encodeURIComponent(id)}`, "data-tip": "Ouvrir dans le studio de pièce : dessin, DFx, interfaces" }, icon("part"))));
    const body = el("div", { class: "side-scroll" }); right.append(body);
    if (!all.length) body.append(el("p", { class: "atelier-hint" }, icon("info"), " Clic droit sur une face plane de la barre : « Poser un contact à pression ici » ou « Poser une borne vissée ici »."));
    for (const x of all) {
      const on = x.id === st.sel, ct = isContact(x), set = (label, fn) => { st.sel = x.id; edit(`${x.id} : ${label}`, fn); };
      const pick = (key, label, opts, tip) => field(label, el("select", { "data-tip": tip || null, onChange: (e) => set(label, (q) => { q[key] = e.target.value; }) }, opts.map(([k, l]) => el("option", { value: k, selected: k === x[key] }, l))));
      const num = (key, label, step = 0.5, min = 0) => field(label, el("input", { type: "number", value: x[key], step, min, onChange: (e) => { const v = parseFloat(e.target.value); if (v >= min) set(label, (q) => { q[key] = v; }); } }));
      const card = el("div", { class: "card" + (on ? " taped" : ""), style: { padding: ".55rem .7rem", marginBottom: ".5rem", cursor: "pointer" }, "data-conn": x.id, onClick: (e) => { if (e.target.closest("input, select, button, label, .cf-box")) return; st.sel = on ? null : x.id; mark(); renderRight(); } },
        el("div", { style: { display: "flex", gap: ".4rem", alignItems: "center", flexWrap: "wrap" } }, el("b", null, x.id), badge(ct ? CONTACT_FORMS[contactForm(x, { band: x.band })].name : `Borne ${x.screw}`, ct ? "info" : "neutral"), el("small", { class: "muted" }, `branche ${x.leg + 1} · à ${fr(x.s, 1)} mm${ct ? ` · ${x.side > 0 ? "face du dessus" : "face du dessous"}` : ""}`)));
      if (ct) { const e = contactEstimate(x), P = PLATINGS[x.plating], Q = contactParams(d, x), more = contactFormNotes(Q, { band: x.band });
        card.append(el("p", { class: "small", style: { margin: ".25rem 0" } }, `${x.n} points · ${P.fr.toLowerCase()} · ≈ ${fr(e.rTotal, 3)} mΩ · ≈ ${fr(e.iMax, 0)} A `, badge(e.ok && !more.length ? "estimation" : "à vérifier", e.ok && !more.length ? "ok" : "warn")));
        if (on) { const form = contactForm(x, { band: x.band });
          card.style.borderLeft = `5px solid ${FORM_COLOR[form]}`;
          card.append(contactFormPicker({ p: Q, opts: { band: x.band }, t: d.t, pick: (k) => set(`forme : ${CONTACT_FORMS[k].fr.toLowerCase()}`, (q) => { q.form = k; delete q.band; if (k !== "cone") delete q.weld; if (k !== "band" && !["Cu", "CuBe", "CuNiSi", "CuSn"].includes(q.base)) q.base = "Cu"; }),
            apply: (a) => set("conseil appliqué", (q) => { q.form = a.form; delete q.band; q.plating = a.plating; q.n = Math.max(q.n || 1, a.n); if (a.form !== "cone") delete q.weld; }) }),
            ...[form === "cone" ? el("label", { class: "check small", "data-tip": "Option : les bossages servent de bossages de soudage — sous l'effort et le courant, ils fondent et les deux barres sont soudées. Permanent, et à qualifier : l'ISO 8167 ne couvre pas le cuivre." },
              el("input", { type: "checkbox", checked: x.weld === "projection", onChange: (ev) => set("soudage par bossage", (q) => { if (ev.target.checked) q.weld = "projection"; else delete q.weld; }) }), "Souder par bossage (option)") : null].filter(Boolean)); }
        if (on) card.append(el("div", { class: "form-row tight" }, pick("role", "Ce côté porte", [["A", "les points de contact"], ["B", "la plage plane"]], "L'autre barre porte l'autre moitié, avec la même clé"), pick("duty", "Usage", [["power", "Puissance"], ["signal", "Signal (RS-485, mesure)"]])),
          el("div", { class: "form-row tight" }, pick("plating", "Revêtement", Object.entries(PLATINGS).map(([k, v]) => [k, v.fr]), P.use), pick("base", "Ressort", Object.entries(CONTACT_BASES).map(([k, v]) => [k, v.fr.split(" (")[0]]), CONTACT_BASES[x.base].use)),
          el("div", { class: "form-row tight" }, num("w", "Longueur"), num("h", "Largeur"), num("n", "Points", 1, 1)), el("div", { class: "form-row tight" }, num("force", "Effort par point (N)", 0.1, 0.1), num("gap", "Hauteur comprimée", 0.1, 0.1), num("i", "Courant (A)", 1, 0), num("u", "Tension (V continu)", 1, 0)),
          el("label", { class: "check small" }, el("input", { type: "checkbox", checked: !!x.external, onChange: (ev) => set("externe", (q) => { if (ev.target.checked) q.external = true; else delete q.external; }) }), "Externe : l'autre barre n'est pas dans le projet"),
          el("p", { class: "muted", style: { fontSize: ".76rem" } }, `${P.std} ; ressort ${CONTACT_BASES[x.base].std}. ${CONTACT_TESTS}. Estimation du premier ordre : l'essai fait foi.`), ...[...e.notes, ...more].map((t) => el("p", { class: "atelier-hint warn", style: { fontSize: ".8rem" } }, t)));
      } else if (on) card.append(el("div", { class: "form-row tight" }, pick("screw", "Vis", Object.keys(THREADS).map((k) => [k, k])), num("s", "Position sur la branche", 0.5)));
      if (on) card.append(el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } }, ...(ct ? [btn("Tourner", () => set("tourné", (q) => { q.turn = q.turn ? 0 : 1; }), { small: true, icon: "refresh", tip: "Un quart de tour (R)" }), btn("Autre face", () => set("autre face", (q) => { q.side = -q.side; }), { small: true, icon: "layers", tip: "La face opposée de la branche (V)" })] : []),
        btn("Retirer", () => { const gone = x.id; st.sel = null; change(`${gone} retiré`, (q) => { q.terminals = q.terminals.filter((k) => k.id !== gone); q.contacts = q.contacts.filter((k) => k.id !== gone); }); }, { small: true, icon: "trash", danger: true })));
      body.append(card);
    }
    body.append(el("div", { class: "side-section" }, el("h3", null, "À la souris et au clavier"), el("table", { class: "data" }, el("tbody", null, KEYS.map(([k, t]) => el("tr", null, el("td", null, el("kbd", null, k)), el("td", { style: { fontSize: ".8rem" } }, t)))))));
  }
  const off = store.on("change", () => { if (!store.part(id) || !store.part(id).busbar) { go("#/busbar"); return; } renderLeft(); renderRight(); build(); });
  renderLeft(); renderRight(); build(true);
  return () => { off(); st.token++; };
}

registerModule({ key: "busbar", label: "Busbars", icon: "power", tip: "Busbars : un conducteur plié et poinçonné, ses bornes et ses contacts à lamelles posés à la souris sur ses faces planes", render });
