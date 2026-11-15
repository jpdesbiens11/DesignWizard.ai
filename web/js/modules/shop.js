/* DesignWizard.ai — the Shop (« Atelier » in French): a part is born from its design intent, the way a craftsman works. No sketch, no plane:
   the user says what the part is for, what it connects to (interfaces, by their shape), what it is made of and which
   raw stock is taken from the rack. The shop companion writes the part at once — smallest envelope carrying the
   interfaces, commercial thickness, routing sheet — and shows it live. The same intent can be handed to Claude. */

import { el, clear, icon, btn, badge, field, toast, copyText, fmt, fmtMass, debounce } from "../core/dom.js";
import { registerModule, go, setStatus, setContext } from "../core/app.js";
import { store } from "../core/store.js";
import { kernel } from "../cad/client.js";
import { Viewer } from "../core/viewer.js";
import { showBuilt } from "../core/viewport.js";
import { synthesize, recommend, SHOP_FORMS, WHERE } from "../core/shop_intent.js";
import { moldProcess, MOLD_RULES } from "../core/shop_mold.js";
import { moldArch, hostOf } from "../core/shop_mold_more.js";
import { extrusionProcess, EXTRUSION_RULES, DEFAULT_CONTENTS } from "../core/shop_extrusion.js";
import { routing } from "../cad/shop.js";
import { STOCK_FORMS } from "../cad/stock.js";
import { INTERFACE_TYPES, interfaceSignature, ADHESIVES, BOND_PREPS } from "../cad/interfaces.js";
import { THREADS } from "../cad/standards.js";
import { WELD_PROCESSES, PLATINGS } from "../cad/interfaces_elec.js";
import { MATERIALS, PROCESSES, material } from "../cad/materials.js";
import { anticipatedInterfaces, shopPrompt } from "../core/prompts.js";
import { importPart } from "../core/importer.js";
import { runDfx } from "../analysis/dfx_api.js";
import { orderCheck } from "../cad/order.js";
import { lightSide, sideOf, LIT } from "../core/view_marks.js";
import { popupMenu } from "../core/view_select.js";

const blank = () => ({ name: "", fn: "", loads: "", environment: "", quantity: 10, priority: "", material: "AL6061-T6", form: "", neighbours: [], interfaces: [], addToAsm: true });
let brief = blank(), uid = 0, wasMoulded = false;

/* Interfaces offered by their shape — what the part DOES with its neighbour — rather than by a CAD feature. */
const SHAPES = [
  { type: "bolt_pattern", side: "A", icon: "bolt", name: "Fixation vissée", title: "Je me visse sur…", text: "Trous de passage : mes vis entrent dans le voisin." },
  { type: "bolt_pattern", side: "B", icon: "tap", name: "Fixation taraudée", title: "On se visse sur moi", text: "Taraudages ou inserts : je reçois les vis du voisin." },
  { type: "planar", side: "A", icon: "layers", name: "Appui plan", title: "Je m'appuie sur…", text: "Deux faces planes en contact : appui, joint, pad thermique." },
  { type: "bond", side: "B", icon: "layers", name: "Plage de collage", title: "Je me colle sur…", text: "Un joint collé : plage, épaisseur du film tenue par des plots, colle, préparation." },
  { type: "fit", side: "A", icon: "lathe", name: "Portée d'ajustement", title: "Je m'emmanche dans…", text: "Une portée cylindrique centrée dans un alésage." },
  { type: "fit", side: "B", icon: "drill", name: "Alésage d'ajustement", title: "Je reçois un arbre", text: "Un alésage ajusté qui centre le voisin." },
  { type: "cutout", side: "A", icon: "section", name: "Ouverture", title: "Je laisse passer…", text: "Une ouverture : connecteur, câble, afficheur, évent." },
  { type: "pins", side: "A", icon: "ruler", name: "Goupilles de positionnement", title: "Je me positionne par goupilles", text: "Deux goupilles donnent la position exacte." },
  { type: "rail", side: "B", icon: "minus", name: "Glissière", title: "Je guide une carte", text: "Une rainure où glisse le bord d'un PCB ou d'une tôle." },
  { type: "weld", side: "A", icon: "power", name: "Soudure", title: "Je me soude sur…", text: "Liaison électrique permanente : laser, résistance, ultrasons ou fils câblés (wirebonding)." },
  { type: "contact", side: "A", icon: "power", name: "Contact à lamelles", title: "Je fais contact par pression", text: "Une bande de lamelles estampées sur une plage plane de busbar : signal ou puissance." },
];
const OPPOSITE = { "+Z": "-Z", "-Z": "+Z", "+X": "-X", "-X": "+X", "+Y": "-Y", "-Y": "+Y" };
const numIn = (obj, key, label, redraw, step = 1) => field(label, el("input", { type: "number", value: obj[key] ?? "", step, min: 0, onInput: (e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) { obj[key] = v; redraw(); } } }));

function render(main) {
  const p = store.project, page = el("div", { class: "page atelier" });
  main.append(page);
  let viewer = null, token = 0, current = null, active = null, flash = null;        // active : the interface whose face the mouse is choosing ; flash : the side just chosen, to confirm in green
  page.append(el("div", { class: "page-head" }, el("div", { class: "grow" }, el("h1", null, "Atelier"),
    el("p", { class: "muted" }, "Pas d'esquisse, pas de plan : dites à quoi sert la pièce, à quoi elle se raccorde, dans quoi elle est faite. Le compagnon d'atelier prend la matière première du commerce et écrit la pièce — vous la voyez naître à droite.")),
    el("div", { class: "subtabs" }, el("a", { class: "subtab active", href: "#/shop" }, "Intention d'abord"), el("a", { class: "subtab", href: "#/interfaces" }, "Entrevue avec Claude"), el("a", { class: "subtab", href: "#/interfaces/registre" }, "Registre des interfaces"), el("a", { class: "subtab", href: "#/library", "data-tip": "Connecteurs basse et haute tension de familles réelles, cellules Li-ion" }, "Bibliothèque électrique"), el("a", { class: "subtab", href: "#/busbar", "data-tip": "Un conducteur plié et poinçonné, ses bornes et ses contacts à lamelles" }, "Busbars"))));
  const left = el("div", { class: "atelier-brief" }), right = el("div", { class: "atelier-side" });
  page.append(el("div", { class: "atelier-grid" }, left, right));
  const rebuild = debounce(() => build(), 220);
  const propose = () => { token++; create.disabled = true; rebuild(); };   // the shown part is stale from the first keystroke: no creation until it is rebuilt
  /* ---- the faces of the proposal answer the lists, and the mouse answers the faces ---- */
  const mark = (side, color, tag) => { if (!viewer) return; viewer.clearOverlays(tag); if (side) lightSide(viewer, side, { color, tag, ids: ["at"] }); };
  const chosen = () => brief.interfaces.find((x) => x.uid === active) || null;
  const named = () => { const it = chosen(); mark(it ? it.where : null, LIT.named, "named"); };
  const put = (it, side) => { it.where = side; active = it.uid; flash = side; drawIfaces(); drawStock(); propose(); };
  const onHover = (h) => { const side = h ? sideOf(h.normal) : null; mark(side, LIT.hover, "hover"); holder.style.cursor = side && chosen() ? "pointer" : ""; };
  const onPick = (h) => {
    const side = h ? sideOf(h.normal) : null, it = chosen(); if (!side) return;
    if (!it) { toast("Choisissez d'abord une interface (cliquez sa carte à gauche), ou faites un clic droit sur la face pour en ajouter une.", "info", 4500); return; }
    if (it.where === side) { mark(side, LIT.chosen, "chosen"); setTimeout(() => mark(null, null, "chosen"), 900); } else put(it, side);
  };
  const onMenu = (h, e) => { const side = h ? sideOf(h.normal) : null;
    popupMenu(e, side ? [{ title: `Face : ${WHERE[side]}` }, ...brief.interfaces.map((it) => ({ label: `Mettre « ${it.name || INTERFACE_TYPES[it.type].fr} » ici`, icon: "interfaces", disabled: it.where === side, run: () => put(it, side) })),
      "—", { label: "Vue normale à cette face", keys: "N", icon: "eye", run: () => viewer.lookAlong(h.normal) }, "—", { title: "Ajouter une interface ici" }, ...SHAPES.map((sh) => ({ label: sh.title, icon: sh.icon, run: () => addShape(sh, side) }))]
      : [{ title: "Vue" }, { label: "Cadrer tout", icon: "fit", run: () => viewer.fit() }, { label: "Vue isométrique", icon: "part", run: () => viewer.view("iso") }, { label: "Dessus", icon: "part", run: () => viewer.view("top") }, { label: "Face", icon: "part", run: () => viewer.view("front") }]); };

  /* 1 — intention */
  const text = (key, label, ph, tag = "input") => { const i = el(tag, tag === "input" ? { type: "text", value: brief[key], placeholder: ph } : { rows: 2, value: brief[key], placeholder: ph }); i.addEventListener("input", () => { brief[key] = i.value; propose(); }); return field(label, i); };
  const qty = el("input", { type: "number", min: 1, step: 1, value: brief.quantity, onInput: (e) => { brief.quantity = Math.max(1, parseInt(e.target.value, 10) || 1); drawStock(); propose(); } });
  const prio = el("select", { onChange: (e) => { brief.priority = e.target.value; propose(); } }, [["", "Équilibre"], ["cost", "Le coût"], ["mass", "La masse"], ["stiffness", "La rigidité"], ["lead_time", "Le délai"]].map(([k, l]) => el("option", { value: k, selected: k === brief.priority }, l)));
  left.append(el("section", { class: "card taped" }, el("h2", null, el("span", { class: "step-no" }, "1"), "L'intention"),
    el("div", { class: "form-row" }, text("name", "Nom de la pièce", "Ex. : Support du capteur de position"), field("Quantité", qty), field("Ce qui compte le plus", prio)),
    text("fn", "À quoi sert-elle ? (une phrase)", "Ex. : Tient le capteur face à l'aimant du rotor, réglable de ± 1 mm"),
    el("div", { class: "form-row" }, text("loads", "Efforts et charges", "Ex. : 20 N en bout, vibrations"), text("environment", "Milieu", "Ex. : −20 à 60 °C, intérieur, 400 V à proximité"))));

  /* 2 — interfaces */
  const neigh = el("div", { class: "atelier-neigh" }), list = el("div"), gallery = el("div", { class: "shape-grid" });
  for (const part of p.parts) {
    const cb = el("input", { type: "checkbox", checked: brief.neighbours.includes(part.id), onChange: () => { brief.neighbours = cb.checked ? [...brief.neighbours, part.id] : brief.neighbours.filter((x) => x !== part.id); syncNeighbours(); drawIfaces(); drawStock(); propose(); } });
    neigh.append(el("label", { class: "check" }, cb, el("span", null, part.name || part.id, " ", el("small", { class: "muted" }, part.id))));
  }
  for (const s of SHAPES) gallery.append(el("button", { class: "shape-card", type: "button", onClick: () => addShape(s) }, icon(s.icon), el("b", null, s.title), el("small", null, s.text)));
  left.append(el("section", { class: "card taped" }, el("h2", null, el("span", { class: "step-no" }, "2"), "Ses interfaces"),
    el("p", { class: "muted small" }, "La pièce n'existe que par ce qu'elle relie. Cochez ses voisines déjà dans le projet — leurs interfaces libres deviennent les siennes — puis ajoutez les autres par leur forme."),
    p.parts.length ? neigh : el("p", { class: "muted small" }, "Aucune pièce dans le projet : celle-ci définira les premières interfaces."), list,
    el("h3", null, "Ajouter une interface par sa forme"), gallery));

  /* 3 — material and raw stock */
  const matSel = el("select", { onChange: (e) => { brief.material = e.target.value; drawIfaces(); drawStock(); propose(); } },
    ["metal", "plastic"].map((cls) => el("optgroup", { label: cls === "metal" ? "Métaux" : "Plastiques" }, MATERIALS.filter((m) => m.cls === cls).map((m) => el("option", { value: m.id, selected: m.id === brief.material }, m.name)))));
  const stockGrid = el("div", { class: "stock-grid" }), stockWhy = el("p", { class: "muted small" }), moldBox = el("div"), profBox = el("div");
  left.append(el("section", { class: "card taped" }, el("h2", null, el("span", { class: "step-no" }, "3"), "Sa matière et sa matière première"),
    el("div", { class: "form-row" }, field("Matériau", matSel)), el("h3", null, "Ce que l'on prend sur l'étagère"), stockGrid, stockWhy, moldBox, profBox));

  /* 4 — the proposal */
  const holder = el("div", { class: "viewport atelier-view" }), chips = el("div", { class: "atelier-chips" }), out = el("div");
  const create = btn("Créer la pièce", () => createPart(), { primary: true, icon: "check", disabled: true });
  const asmBox = el("input", { type: "checkbox", checked: brief.addToAsm, onChange: (e) => { brief.addToAsm = e.target.checked; } });
  right.append(el("section", { class: "card taped" }, el("h2", null, el("span", { class: "step-no" }, "4"), "La pièce proposée"), holder, chips, out,
    el("div", { class: "form-actions" }, el("label", { class: "check", style: { marginRight: "auto" } }, asmBox, p.assemblies.length ? `Ajouter à ${p.assemblies[0].id} et mater` : "Assembler avec ses voisines et mater"),
      btn("Affiner avec Claude", async () => { if (!current) return; toast((await copyText(shopPrompt(p, brief, current.spec))) ? "Prompt copié : collez-le dans Claude, puis collez sa réponse dans « Entrevue avec Claude »." : "Copie impossible.", "success", 6000); }, { icon: "wizard", tip: "Copie un prompt qui contient l'intention et cette proposition : Claude l'améliore sans toucher aux interfaces" }),
      create)));

  function syncNeighbours() {
    const ant = anticipatedInterfaces(p, brief.neighbours), keep = new Set(ant.map((a) => `${a.from.part}/${a.from.iface}`));
    brief.interfaces = brief.interfaces.filter((it) => !it.from || keep.has(`${it.from.part}/${it.from.iface}`));
    for (const a of ant) {
      if (brief.interfaces.some((it) => it.from && it.from.part === a.from.part && it.from.iface === a.from.iface)) continue;
      const src = (store.part(a.from.part).interfaces || []).find((x) => x.id === a.from.iface) || {};
      brief.interfaces.push({ uid: ++uid, from: a.from, type: a.iface.type, name: a.iface.name, partner: a.iface.partner, key: a.iface.key, side: a.iface.side, params: a.iface.params, where: OPPOSITE[src.face || "+Z"] || "+Z" });
    }
  }
  function addShape(s, where = "+Z") {
    const t = INTERFACE_TYPES[s.type];
    brief.interfaces.push({ uid: ++uid, type: s.type, side: s.side, name: s.name, partner: "", where, params: JSON.parse(JSON.stringify(t.params)) }); active = uid; flash = where;
    if (s.type === "cutout") delete brief.interfaces.at(-1).params.fix;
    drawIfaces(); drawStock(); propose();
  }
  function quick(it, redraw) {
    const q = it.params, row = el("div", { class: "form-row tight" });
    if (it.type === "bolt_pattern") {
      const pat = q.pattern || (q.pattern = { type: "rect", nx: 2, ny: 2, dx: 40, dy: 30 });
      row.append(field("Vis", el("select", { onChange: (e) => { q.screw = e.target.value; redraw(); } }, Object.keys(THREADS).map((k) => el("option", { value: k, selected: k === q.screw }, k)))),
        field("Motif", el("select", { onChange: (e) => { q.pattern = e.target.value === "circle" ? { type: "circle", n: 4, pcd: 40 } : e.target.value === "single" ? { type: "single" } : { type: "rect", nx: 2, ny: 2, dx: 40, dy: 30 }; drawIfaces(); redraw(); } },
          [["rect", "Rectangle"], ["circle", "Cercle"], ["single", "Une vis"]].map(([k, l]) => el("option", { value: k, selected: k === (pat.type || "rect") }, l)))));
      if (pat.type === "circle") row.append(numIn(pat, "n", "Nombre", redraw), numIn(pat, "pcd", "Ø de perçage", redraw, 0.5));
      else if (pat.type !== "single") row.append(numIn(pat, "nx", "En X", redraw), numIn(pat, "ny", "En Y", redraw), numIn(pat, "dx", "Entraxe X", redraw, 0.5), numIn(pat, "dy", "Entraxe Y", redraw, 0.5));
    } else if (it.type === "planar") row.append(numIn(q, "w", "Largeur", redraw), numIn(q, "h", "Hauteur", redraw));
    else if (it.type === "bond") { const a = ADHESIVES[q.adhesive] || ADHESIVES.epoxy, pickOf = (key, list) => el("select", { onChange: (e) => { q[key] = e.target.value; if (key === "adhesive") { const g = ADHESIVES[q.adhesive].gap; if (q.gap < g[0] || q.gap > g[1]) q.gap = g[0] <= 0.2 && g[1] >= 0.2 ? 0.2 : g[0]; drawIfaces(); } redraw(); } }, list.map(([k, l]) => el("option", { value: k, selected: k === q[key] }, l)));
      row.append(numIn(q, "w", "Longueur de la plage", redraw, 0.5), numIn(q, "h", "Largeur", redraw, 0.5), field("Film de colle (mm)", el("input", { type: "number", value: q.gap, step: 0.05, min: 0.02, "data-tip": `Tenu par des plots de calage dans la pièce. Plage usuelle de cette colle : ${String(a.gap[0]).replace(".", ",")} à ${String(a.gap[1]).replace(".", ",")} mm`, onInput: (e) => { const v = parseFloat(e.target.value); if (v > 0) { q.gap = v; redraw(); } } })),
        field("Colle", pickOf("adhesive", Object.entries(ADHESIVES).map(([k, v]) => [k, v.fr]))), field("Préparation", pickOf("prep", Object.entries(BOND_PREPS).map(([k, v]) => [k, v.split(",")[0].split(" à ")[0]])))); }
    else if (it.type === "fit") row.append(numIn(q, "d", "Diamètre", redraw, 0.5), numIn(q, "length", "Longueur", redraw, 0.5));
    else if (it.type === "cutout") row.append(numIn(q, "w", "Largeur", redraw, 0.5), numIn(q, "h", "Hauteur", redraw, 0.5), numIn(q, "r", "Rayon", redraw, 0.5));
    else if (it.type === "rail") row.append(numIn(q, "t", "Épaisseur", redraw, 0.1), numIn(q, "depth", "Profondeur", redraw, 0.5), numIn(q, "length", "Longueur", redraw));
    else if (it.type === "weld") row.append(field("Procédé", el("select", { onChange: (e) => { q.process = e.target.value; redraw(); } }, Object.entries(WELD_PROCESSES).map(([k, w]) => el("option", { value: k, selected: k === q.process }, w.fr)))), numIn(q, "w", "Longueur de la zone", redraw, 0.5), numIn(q, "h", "Largeur", redraw, 0.5), numIn(q, "n", "Cordons, points ou fils", redraw), numIn(q, "i", "Courant (A)", redraw));
    else if (it.type === "contact") row.append(numIn(q, "w", "Longueur de la plage", redraw, 0.5), numIn(q, "h", "Largeur", redraw, 0.5), numIn(q, "n", "Points de contact", redraw), numIn(q, "i", "Courant (A)", redraw),
      field("Revêtement", el("select", { onChange: (e) => { q.plating = e.target.value; redraw(); } }, Object.entries(PLATINGS).map(([k, v]) => el("option", { value: k, selected: k === q.plating }, v.fr)))), field("Usage", el("select", { onChange: (e) => { q.duty = e.target.value; redraw(); } }, [["power", "Puissance"], ["signal", "Signal"]].map(([k, l]) => el("option", { value: k, selected: k === q.duty }, l)))));
    else if (it.type === "pins") row.append(numIn(q, "d", "Ø goupille", redraw, 0.5), numIn(q, "pitch", "Entraxe", redraw), numIn(q, "n", "Nombre", redraw));
    return row;
  }
  function drawIfaces() {
    clear(list);
    if (!brief.interfaces.length) list.append(el("p", { class: "atelier-hint" }, icon("info"), " Ajoutez une première interface : la pièce se dessine autour."));
    for (const it of brief.interfaces) {
      const t = INTERFACE_TYPES[it.type], where = el("select", { "aria-label": "Face de la pièce", "data-tip": "La face s'allume sur la pièce ; vous pouvez aussi la cliquer dans la vue", onFocus: () => mark(it.where, LIT.named, "named"), onChange: (e) => put(it, e.target.value) }, Object.entries(WHERE).map(([k, l]) => el("option", { value: k, selected: k === it.where }, `sur le ${l}`.replace("le avant", "l'avant").replace("le arrière", "l'arrière").replace("le gauche", "la gauche").replace("le droite", "la droite"))));
      const head = el("div", { class: "iface-head" }, badge(`côté ${it.side}`, it.side === "B" ? "b" : "a"), el("b", null, t.fr), where,
        el("button", { class: "icon-btn", type: "button", "aria-label": "Retirer l'interface", "data-tip": it.from ? "Retirer (décochez le voisin pour l'oublier)" : "Retirer", onClick: () => { brief.interfaces = brief.interfaces.filter((x) => x !== it); if (it.from) { brief.neighbours = brief.neighbours.filter((n) => brief.interfaces.some((x) => x.from && x.from.part === n)); [...neigh.querySelectorAll("input")].forEach((cb, i) => { cb.checked = brief.neighbours.includes(p.parts[i].id); }); } drawIfaces(); drawStock(); propose(); } }, "×"));
      const card = el("div", { class: "iface-card" + (it.from ? " imposed" : "") + (it.uid === active ? " active" : ""), "data-uid": it.uid, onMouseenter: () => mark(it.where, LIT.named, "named"), onMouseleave: () => named(),
        onPointerdown: () => { if (active === it.uid) return; active = it.uid; for (const c of list.children) c.classList.toggle("active", c === card); named(); } }, head);
      if (it.from) card.append(el("p", { class: "muted small" }, icon("lock"), ` Imposée par ${it.from.name} — ${it.name}, clé `, el("code", null, it.key), ` · ${interfaceSignature(it)}`));
      else {
        const nm = el("input", { type: "text", value: it.name, placeholder: "Nom de l'interface", onInput: (e) => { it.name = e.target.value; propose(); } }), pt = el("input", { type: "text", value: it.partner, placeholder: "Voisin (ex. : moteur, capot)", onInput: (e) => { it.partner = e.target.value; propose(); } });
        card.append(el("div", { class: "form-row tight" }, field("Nom", nm), field("Avec", pt)), quick(it, () => { drawStock(); propose(); }));
      }
      if (!it.from) card.append(el("label", { class: "check small" }, el("input", { type: "checkbox", checked: !!it.external, onChange: (e) => { if (e.target.checked) it.external = true; else delete it.external; propose(); } }), "Externe : vers l'extérieur du produit (aucune pièce du projet ne s'y accouple)"));
      if (wasMoulded) card.append(el("label", { class: "check small" }, el("input", { type: "checkbox", checked: !!it.inside, onChange: (e) => { it.inside = e.target.checked; propose(); } }), "À l'intérieur : ce qui se fixe au fond de la pièce (carte, module) — sur colonnettes"));
      list.append(card);
    }
  }
  function drawStock() {
    clear(stockGrid);
    const rec = recommend(brief), mat = material(brief.material), plastic = mat && mat.cls !== "metal";
    for (const [form, proc] of Object.entries(SHOP_FORMS)) {
      const mould = form === "molded", canMould = mat && ["injection_molding", "die_casting", "sand_casting"].some((k) => mat.processes.includes(k));
      const prof = form === "profile", canExtrude = mat && mat.processes.some((k) => /^extrusion_/.test(k));
      const f = STOCK_FORMS[form], on = (brief.form || rec.form) === form, odd = mould ? !canMould : prof ? !canExtrude : form === "print" ? !plastic : (plastic && ["sheet", "angle"].includes(form));
      stockGrid.append(el("button", { class: "stock-card" + (on ? " on" : "") + (odd ? " odd" : ""), type: "button", "aria-pressed": on ? "true" : "false", "data-tip": f.hint, onClick: () => { brief.form = form === rec.form ? "" : form;
        if (prof && brief.form && !canExtrude) { brief.material = plastic ? "PVC-U" : "AL6063-T5"; matSel.value = brief.material; toast(`Matière changée pour ${material(brief.material).name} : celle d'avant ne s'extrude pas.`, "info", 4500); }
        drawStock(); propose(); } },
        icon(f.icon), el("b", null, f.fr), el("small", null, PROCESSES[mould ? moldProcess(brief.material) : prof ? extrusionProcess(brief.material) : proc].fr), form === rec.form ? badge("Conseillé", "ok") : null));
    }
    /* a moulded part is drawn around what it holds : the designer gives the volume to contain, the rules of the moulder do the rest */
    clear(moldBox);
    const moulded = (brief.form || rec.form) === "molded";
    if (moulded) {
      const proc = moldProcess(brief.material), R = MOLD_RULES[proc], lim = (mat && mat.wall) || R.wall, again = () => propose(), arch = moldArch(brief, brief.interfaces), metal = R.thread === "tapped";
      const pick = (k, label, tip) => el("button", { class: "btn btn-small" + (arch === k ? " btn-primary" : ""), type: "button", "aria-pressed": arch === k ? "true" : "false", "data-tip": tip, onClick: () => { brief.arch = k; drawStock(); propose(); } }, label);
      const wallTxt = `paroi de ${String(lim[0]).replace(".", ",")} à ${String(lim[1]).replace(".", ",")} mm pour cette matière`;
      moldBox.append(el("div", { class: "atelier-hint", style: { marginTop: ".6rem" } }, icon("cast"), el("div", null, el("b", null, `Pièce moulée — ${PROCESSES[proc].fr.toLowerCase()}`),
        el("div", { class: "form-actions", style: { justifyContent: "flex-start", margin: ".35rem 0", flexWrap: "wrap" } }, pick("shell", "Coque — elle contient", "Un boîtier, un carter : dessiné autour du volume à loger et de ce qui se fixe dedans"),
          pick("cover", "Couvercle — il ferme", "Assorti au boîtier voisin : même contour, lèvre de centrage, trous au droit de ses bossages ou crochets dans ses fenêtres"), pick("plate", "Platine nervurée — elle porte", "Une pièce pleine : une paroi, une ceinture et des nervures croisées dessous, des bossages sous ses filets")),
        el("p", { class: "small", style: { margin: ".2rem 0 0" } }, arch === "cover" ? `Cochez plus haut le boîtier que ce couvercle ferme : il en reprend le contour, les rayons, la dépouille et la fermeture (vis ou clips). Lèvre de centrage, nervures, ${wallTxt}.`
          : arch === "plate" ? `Donnez la longueur et la largeur ; les interfaces se posent dessus. Une seule paroi (${wallTxt}), une ceinture et des nervures croisées dessous, des bossages${metal ? " taraudés après coulée" : " à inserts"} sous les filets.`
          : `Dites le volume à contenir ; cochez « à l'intérieur » les interfaces de ce qui se fixe dedans. La pièce se dessine seule : ${wallTxt}, rayons, bossages${metal ? " taraudés après coulée" : " avec inserts"}, nervures, dépouille réelle.`))));
      if (arch !== "cover") { brief.envelope = brief.envelope || { L: 100, W: 60, H: 25 };
        moldBox.append(el("div", { class: "form-row tight" }, numIn(brief.envelope, "L", arch === "plate" ? "Longueur" : "Longueur à contenir", again), numIn(brief.envelope, "W", arch === "plate" ? "Largeur" : "Largeur à contenir", again),
          arch === "shell" ? numIn(brief.envelope, "H", "Hauteur à contenir", again) : null,
          arch === "shell" ? field("Colonnettes (mm)", el("input", { type: "number", value: brief.standoff ?? 6, step: 0.5, min: 3, onInput: (e) => { const v = parseFloat(e.target.value); if (v >= 3) { brief.standoff = v; again(); } } })) : null,
          arch === "shell" ? field("Fermeture", el("select", { "data-tip": "Des vis dans des bossages, ou des clips : des fenêtres dans les grands côtés, où s'accrochent les crochets du couvercle", onChange: (e) => { brief.closure = e.target.value === "clips" ? "clips" : undefined; brief.cover = e.target.value === "none" ? false : undefined; again(); } },
            [["screws", "Vis dans des bossages"], ["clips", metal ? "Clips (plastique seulement)" : "Clips, sans vis"], ["none", "Aucune"]].map(([k, l]) => el("option", { value: k, selected: k === (brief.cover === false ? "none" : brief.closure === "clips" ? "clips" : "screws") }, l)))) : null)); }
      moldBox.append(el("label", { class: "check small" }, el("input", { type: "checkbox", checked: brief.draft !== false, onChange: (e) => { brief.draft = e.target.checked ? undefined : false; again(); } }), `Dépouille modélisée dans la géométrie (${Math.max(R.draft[0], R.draft[1])}°) — décochez pour un modèle droit, dépouille déclarée seulement`));
    }
    /* an extruded profile is drawn around what slides, rests or simply fits in it */
    clear(profBox);
    if ((brief.form || rec.form) === "profile") {
      const R = EXTRUSION_RULES[extrusionProcess(brief.material)], again = () => propose(), list = brief.contents || (brief.contents = DEFAULT_CONTENTS()); brief.length = brief.length || 120;
      profBox.append(el("div", { class: "atelier-hint", style: { marginTop: ".6rem" } }, icon("extrusion"), el("div", null, el("b", null, `Profilé sur mesure — ${R.fr}`),
        el("p", { class: "small", style: { margin: ".2rem 0 0" } }, "Dites ce qu'il contient : ce qui glisse dans des rainures, ce qui se pose à plat, ce qui doit seulement tenir dedans. La section se dessine seule — une paroi, des rainures avec leur jeu, des nervures, des canaux de vis pour les flasques — et chaque glissière devient une interface que la pièce glissée reprend."))));
      list.forEach((c, i) => profBox.append(el("div", { class: "form-row tight" }, field("Ce qu'il contient", el("input", { type: "text", value: c.name || "", placeholder: "Ex. : Carte de puissance", onInput: (e) => { c.name = e.target.value; again(); } })), numIn(c, "w", "Largeur", again, 0.5), numIn(c, "h", "Hauteur", again, 0.5),
        field("Tenue", el("select", { "data-tip": "Glissé : dans deux rainures, avec son jeu. Posé à plat : sur le fond, les bossages ou deux nervures. Libre : il doit seulement tenir dedans", onChange: (e) => { c.hold = e.target.value; drawStock(); again(); } }, [["rail", "Glissé"], ["flat", "Posé à plat"], ["free", "Libre"]].map(([k, l]) => el("option", { value: k, selected: k === c.hold }, l)))),
        c.hold === "rail" ? numIn(c, "edge", "Épaisseur du bord", again, 0.1) : null, c.hold === "rail" ? numIn(c, "below", "Hauteur sous le bord", again, 0.5) : null,
        el("button", { class: "icon-btn", type: "button", "aria-label": "Retirer cet élément", "data-tip": "Retirer", onClick: () => { list.splice(i, 1); drawStock(); again(); } }, "×"))));
      profBox.append(el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, btn("Ajouter un élément", () => { list.push({ name: `Élément ${list.length + 1}`, w: 60, h: 12, hold: "rail", edge: 1.6, below: 3 }); drawStock(); again(); }, { icon: "plus", small: true })),
        el("div", { class: "form-row tight" }, numIn(brief, "length", "Longueur coupée", again),
          field("Section", el("select", { "data-tip": "Fermée : un tube, la filière porte un mandrin. Ouverte : un U, sans creux — le moins cher en plastique", onChange: (e) => { brief.open = e.target.value === "open" ? true : undefined; again(); } }, [["closed", "Fermée (tube)"], ["open", "Ouverte sur le dessus (U)"]].map(([k, l]) => el("option", { value: k, selected: (k === "open") === !!brief.open }, l)))),
          field("Flasques", el("select", { "data-tip": "Des canaux de vis ouverts en C dans les angles : les flasques des bouts s'y vissent, sans taraudage", onChange: (e) => { if (e.target.value === "none") brief.ports = false; else { brief.ports = undefined; brief.screw = e.target.value; } again(); } }, [["M3", "Canaux de vis M3"], ["M4", "Canaux de vis M4"], ["M5", "Canaux de vis M5"], ["none", "Sans canal de vis"]].map(([k, l]) => el("option", { value: k, selected: brief.ports === false ? k === "none" : k === (brief.screw || "M3") }, l))))));
    }
    if (moulded !== wasMoulded) { wasMoulded = moulded; drawIfaces(); }
    stockWhy.textContent = brief.form && brief.form !== rec.form ? `Votre choix : ${STOCK_FORMS[brief.form].fr.toLowerCase()}. Le compagnon conseillait : ${STOCK_FORMS[rec.form].fr.toLowerCase()} — ${rec.why}` : rec.why;
  }

  async function build() {
    const mine = ++token;
    let res;
    brief.hosts = Object.fromEntries(brief.neighbours.map((id) => [id, hostOf(store.part(id))]).filter(([, h]) => h));      // what a moulded cover reads of the housing it closes
    try { res = synthesize(brief, store.nextPartId()); } catch (e) { clear(out); out.append(el("p", { class: "form-error" }, e.message)); create.disabled = true; return; }
    try {
      const built = await kernel.build(res.spec, null, "~shop");
      if (mine !== token) return;
      current = { ...res, built }; setContext({ spec: res.spec, built });      // what the code view and the AI round trip read
      if (!viewer) { viewer = new Viewer(holder, { onHover, onPick, onMenu }); holder._viewer = viewer; }      // exposed for whoever inspects the page (tests, the console)
      viewer.clear(); showBuilt(viewer, built, { prefix: "at" });
      for (const it of built.interfaces) { viewer.addFrame(it.frame, it.side === "A" ? "#9b7bff" : "#2ec4b6"); viewer.addLabel(it.frame.o, `${it.name}`, "label", "iface"); }
      viewer.view("iso");
      named(); if (flash) { const side = flash; flash = null; mark(side, LIT.chosen, "chosen"); setTimeout(() => { if (viewer) mark(null, null, "chosen"); }, 1400); }      // the face just chosen turns green, then keeps the colour of its interface
      drawProposal(res, built);
      runDfx(res.spec, built).then((dfx) => { if (mine === token) drawOrder(res, built, dfx); });
      const errs = built.log.filter((l) => l.level === "error");
      create.disabled = !!errs.length || !built.bodies.length;
      setStatus(errs.length ? "Proposition à corriger" : "Proposition construite", errs.length ? "bad" : "done");
    } catch (e) { if (mine === token) { clear(out); out.append(el("p", { class: "form-error" }, e.message)); create.disabled = true; } }
  }
  function drawProposal(res, built) {
    const r = routing(res.spec, built), bb = built.bbox, st = built.facts.stock;
    clear(chips); clear(out);
    chips.append(...[el("span", { class: "chip" }, fmtMass(built.mass)), el("span", { class: "chip" }, `${fmt(bb[3] - bb[0], 1)} × ${fmt(bb[4] - bb[1], 1)} × ${fmt(bb[5] - bb[2], 1)} mm`),
      r.utilisation !== null ? el("span", { class: "chip" + (r.utilisation < 0.25 ? " bad" : " done"), "data-tip": "Part du brut qui reste dans la pièce (l'inverse du ratio « buy-to-fly »)" }, `${Math.round(r.utilisation * 100)} % du brut utilisé`) : null,
      el("span", { class: "chip" }, `${r.setups.length || 1} posage(s) · ${r.tools.length} outil(s)`)].filter(Boolean));     // append(null) would write the word « null »
    for (const l of built.log.filter((x) => x.level === "error")) out.append(el("p", { class: "form-error" }, l.msg));
    if (st) out.append(el("div", { class: "atelier-stock" }, icon(STOCK_FORMS[st.form].icon), el("div", null, el("b", null, st.label), el("small", null, `${material(res.spec.material).name} · ${PROCESSES[res.spec.process].fr}`))));
    out.append(el("h3", null, "Gamme de fabrication"), el("ol", { class: "gamme" }, r.steps.map((s) => el("li", { class: `g-${s.kind}` }, el("span", { class: "g-n" }, s.n), el("span", { class: "grow" }, s.text), s.face && s.kind !== "stock" ? badge(WHERE[s.face] || s.face, "neutral") : null))));
    if (r.tools.length) out.append(el("p", { class: "muted small" }, el("b", null, "Outils : "), r.tools.join(" · ")));
    for (const a of r.advice) out.append(el("p", { class: "atelier-hint warn" }, icon("warning"), " ", a));
    out.append(el("h3", null, "Ce que le compagnon a décidé"), el("ul", { class: "decisions" }, res.decisions.map((d) => el("li", null, d))));
  }
  /** Born manufacturable: the DFx verdict and the prototype lead time of the proposal, before the part even exists. */
  function drawOrder(res, built, dfx) {
    const c = orderCheck(res.spec, built, dfx, routing(res.spec, built), { quantity: brief.quantity });
    chips.append(...[el("span", { class: "chip" + (c.ready ? " done" : " bad"), "data-tip": [...c.blockers, ...c.drivers].join(" · ") || null }, c.ready ? `Prototype : ${c.days[0]} à ${c.days[1]} j` : "À corriger avant commande"),
      dfx && dfx.summary ? el("span", { class: "chip" + (dfx.summary.errors ? " bad" : " done") }, dfx.summary.errors ? `DFx : ${dfx.summary.errors} à corriger` : `DFx : fabricable${dfx.summary.warnings ? `, ${dfx.summary.warnings} à vérifier` : ""}`) : null].filter(Boolean));
    for (const t of c.cautions.filter((x) => /prototype/.test(x))) out.prepend(el("p", { class: "atelier-hint warn" }, icon("warning"), " ", t));
  }
  function createPart() {
    if (!current) return;
    const r = importPart(current.spec, { replace: false });
    if (r.errors && r.errors.length) { toast(r.errors.join(" "), "error"); return; }
    const mate = brief.addToAsm && brief.neighbours.length;
    if (mate && !p.assemblies.length) store.commit(`Assemblage créé autour de ${r.id}`, (x) => { x.assemblies.push({ dw: "assembly/1", id: store.uniqueId(`${String(x.name || "ASM").normalize("NFD").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 16).toUpperCase() || "ASM"}-ASM`), name: "Assemblage général",
      instances: [...brief.neighbours, r.id].map((part, n) => ({ id: `i${n + 1}`, part, ...(n ? {} : { fixed: true }), placement: { t: [0, 0, 0], r: [0, 0, 0] } })), mates: [], pendingAutoMate: true }); });
    else if (mate) store.updateAssembly(p.assemblies[0].id, (a) => { a.instances.push({ id: `i${Date.now().toString(36)}`, part: r.id, placement: { t: [0, 0, 0], r: [0, 0, 0] } }); a.pendingAutoMate = true; }, `${r.id} ajoutée à ${p.assemblies[0].id}`);
    toast(`Pièce ${r.id} créée depuis son intention.`, "success");
    brief = blank();
    go(mate ? `#/assembly/${encodeURIComponent(p.assemblies[0].id)}` : `#/parts/${encodeURIComponent(r.id)}`);
  }

  syncNeighbours(); drawIfaces(); drawStock(); build();
  return () => { token++; if (viewer) viewer.dispose(); kernel.forget("~shop").catch(() => {}); };
}

registerModule({ key: "shop", label: "Atelier", icon: "atelier", tip: "La pièce naît de son intention : interfaces, matière, matière première du commerce — sans esquisse", render });
