/* DesignWizard.ai — the part studio shared by Pièces, Extrusion and PCB: list of parts, construction tree, 3D view,
   and the inspector (parameters with sliders, interfaces, live DFx, data sheet, JSON). Every edit is one undo step and
   rebuilds the part in the kernel worker; linked interfaces adapt the neighbouring parts. */

import { el, clear, icon, btn, badge, toast, modal, fmt, fmtMass, download, confirmBox } from "../core/dom.js";
import { store } from "../core/store.js";
import { app, go, setContext, setStatus } from "../core/app.js";
import { kernel } from "../cad/client.js";
import { createViewport, showBuilt } from "../core/viewport.js";
import { TEMPLATES, fromTemplate } from "../cad/templates.js";
import { featureDialog, interfaceDialog, stockDialog, announceLinks, nextFeatureId, nextIfaceId, FEATURE_LABEL, FEATURE_DEFAULT, SHOP_DEFAULT } from "../core/part_edit.js";
import { gammePanel, artifactsPanel } from "./part_gamme.js";
import { STOCK_FORMS } from "../cad/stock.js";
import { paramsPanel, interfacesPanel, sheetPanel, jsonPanel, dfxPanel } from "./part_panels.js";
import { runDfx } from "../analysis/dfx_api.js";
import { lightSide, LIT } from "../core/view_marks.js";
import { partGestures, PART_KEYS } from "./part_gestures.js";

const OP_ICON = { box: "part", cylinder: "part", extrude: "extrusion", revolve: "refresh", hole: "bolt", pocket: "section", pad: "layers", slot: "minus", boss: "bolt", shell: "layers", fillet: "edit", chamfer: "edit", interfaces: "interfaces",
  drill: "drill", tap: "tap", cbore: "drill", csink: "drill", ream: "drill", mill: "mill", groove: "mill", face: "mill", step: "mill", outline: "laser", turn: "lathe", bore: "lathe", break_edges: "deburr", deburr: "deburr", finish: "palette" };

export function partStudio(main, args, cfg) {
  const parts = () => store.parts.filter(cfg.filter || (() => true));
  let id = args[0] && store.part(args[0]) ? args[0] : (parts()[0] && parts()[0].id) || null;
  const st = { spec: id ? store.part(id) : null, built: null, findings: null, token: 0, tab: cfg.defaultTab || "params", placing: null, showFrames: true };

  const left = el("aside", { class: "side" }), right = el("aside", { class: "side right" }), view = el("div");
  const root = el("div", { class: "studio" }, left, view, right);
  main.append(root);
  if (!st.spec) {
    root.classList.add("no-right"); right.remove();
    renderLeft();
    view.append(el("div", { class: "page" }, el("div", { class: "empty" }, el("h2", null, cfg.emptyTitle || "Aucune pièce pour l'instant"),
      el("p", null, cfg.emptyText || "Commencez par l'intention de la pièce (Atelier), ou partez d'un gabarit paramétrique."),
      el("div", { class: "form-actions", style: { justifyContent: "center" } }, el("a", { class: "btn btn-primary", href: "#/shop" }, icon("wizard"), "Démarrer par l'intention"),
        btn("Partir d'un gabarit", () => newPartDialog(cfg), { icon: "plus" })))));
    return null;
  }

  let gest = null;                                                // the mouse and the keys on the model (part_gestures.js)
  const vp = createViewport(view, { select: false, name: () => st.spec.id, onPick: (h, e) => gest.onPick(h, e), onHover: (h) => { gest.onHover(h); onHover(h); }, onMenu: (h, e) => gest.onMenu(h, e), onKey: (e) => gest.onKey(e) });
  const info = el("span", { class: "chip" }, "—"), hover = el("span", { class: "chip hidden" }, ""), stage = el("span", { class: "chip stage hidden" }, "");
  const picked = el("span", { class: "chip picked hidden" }, "");
  vp.setStatus(info, stage, picked, hover);
  const bFrames = btn("", () => { st.showFrames = !st.showFrames; bFrames.classList.toggle("on", st.showFrames); overlays(); }, { small: true, icon: "interfaces", tip: "Afficher les repères des interfaces" });
  bFrames.classList.add("on");
  vp.group(bFrames, btn("Trou ici", () => gest.place("hole"), { small: true, icon: "bolt", tip: "Cliquez ensuite une face plane : le trou est créé à cet endroit" }),
    btn("Interface ici", () => gest.place("iface"), { small: true, icon: "plus", tip: "Cliquez ensuite une face plane : l'interface est créée à cet endroit" }));

  const offChange = store.on("change", (c) => {
    const fresh = store.part(id);
    if (!fresh) { go(`#/${cfg.key}`); return; }
    announceLinks(c);
    st.spec = fresh;
    renderLeft(); renderRight(); rebuild();
  });
  renderLeft(); renderRight(); rebuild(true);

  /* ---------- build ---------- */
  async function rebuild(first, overrides) {
    const token = ++st.token;
    vp.setBusy(st.built ? "" : "Construction de la pièce…");
    setContext({ spec: st.spec, built: st.built });
    try {
      const built = await kernel.build(st.spec, overrides, overrides ? `${st.spec.id}~live` : st.spec.id);
      if (token !== st.token) return;
      st.built = built;
      setContext({ spec: st.spec, built });
      paint(built); if (gest) gest.sel.clear();
      if (first) vp.viewer.view("iso");
      const errs = built.log.filter((l) => l.level === "error").length, warns = built.log.filter((l) => l.level === "warn").length, bb = built.bbox;
      info.textContent = `${fmtMass(built.mass)} · ${fmt(bb[3] - bb[0], 1)} × ${fmt(bb[4] - bb[1], 1)} × ${fmt(bb[5] - bb[2], 1)} mm · ${fmt(built.volume / 1000, 1)} cm³ · ${built.ms} ms`;
      info.className = "chip" + (errs ? " bad" : "");
      if (errs) info.textContent = `${errs} erreur(s) de construction · ` + info.textContent;
      setStatus(errs ? `${st.spec.id} : ${errs} erreur(s)` : `${st.spec.id} construit en ${built.ms} ms`, errs ? "bad" : "done");
      vp.setBusy("");
      if (!overrides) { st.findings = await runDfx(st.spec, built); if (token !== st.token) return; }
      overlays();
      if (st.tab === "dfx" || st.tab === "sheet" || st.tab === "gamme" || first) renderRight();
      if (cfg.onBuilt) cfg.onBuilt(st, vp);
    } catch (e) {
      if (token !== st.token) return;
      vp.setBusy("");
      info.textContent = e.message; info.className = "chip bad";
      setStatus(`${st.spec.id} : construction impossible`, "bad");
    }
  }
  /** Shows a build in the view : the part itself, or the part as it stands after a phase of its routing (label says which). */
  function paint(built, label) {
    const keep = new Set(showBuilt(vp.viewer, built, { prefix: "part" }));
    for (const k of [...vp.viewer.objects.keys()]) if (!keep.has(k)) vp.viewer.remove(k);
    stage.textContent = label || ""; stage.classList.toggle("hidden", !label);
    vp.viewer.invalidate();
  }
  function live(ov) { clearTimeout(st.liveTimer); st.liveTimer = setTimeout(() => rebuild(false, ov), 90); }      // slider drag: rebuild without committing

  function overlays() {
    const v = vp.viewer;
    v.clearOverlays("frame"); v.clearOverlays("dfx");
    if (!st.built) return;
    if (st.showFrames) for (const it of st.built.interfaces) {
      v.addFrame(it.frame, it.side === "A" ? "#9b7bff" : "#2ec4b6", "frame");
      v.addLabel(it.frame.o, `${it.id} · ${it.side}`, "frame", "iface", () => editIface(it.id));
    }
    for (const f of (st.findings && st.findings.findings) || []) if (f.where && f.severity !== "info") {
      v.addMarker(f.where, f.severity === "error" ? "#ff5a4f" : "#ffb020", "dfx");
      v.addLabel(f.where, f.id, "dfx", f.severity === "error" ? "err" : "warn", () => { st.tab = "dfx"; renderRight(); });
    }
  }

  /* ---------- faces : the face a dialog names lights up ; the face under the cursor shows ; the face clicked turns green ---------- */
  const marks = (tag) => vp.viewer.clearOverlays(tag);
  app.faces = {
    light(side, level) { marks("face"); if (side && st.built) lightSide(vp.viewer, side, { tag: "face", color: LIT.named, level, ids: ["part"] }); },
    listen(fn) { st.faceAsk = fn; view.style.cursor = fn ? "crosshair" : ""; marks("selhover"); },
    stop() { st.faceAsk = null; view.style.cursor = st.placing ? "crosshair" : ""; marks("face"); marks("facehover"); },
  };
  /* ---------- the model under the mouse : selection, right-click menu, keys ---------- */
  function faceOfHit(hit) {
    if (!hit || !hit.face || hit.face.type !== "plane") return null;
    const n = hit.face.n, a = [0, 1, 2].reduce((m, i) => (Math.abs(n[i]) > Math.abs(n[m]) ? i : m), 0);
    if (Math.abs(n[a]) < 0.999) return null;
    const face = (n[a] > 0 ? "+" : "-") + "XYZ"[a], plane = a === 2 ? [0, 1] : a === 1 ? [0, 2] : [1, 2], r = (x) => Math.round(x * 10) / 10;
    const bb = st.built.bbox, lvl = Math.round(hit.local[a] * 100) / 100, ext = n[a] > 0 ? bb[3 + a] : bb[a];
    return { face, at: [r(hit.local[plane[0]]), r(hit.local[plane[1]])], level: Math.abs(lvl - ext) > 0.01 ? lvl : undefined };
  }
  const showKeys = () => modal("La pièce à la souris et au clavier", el("table", { class: "data" }, el("tbody", null, PART_KEYS.map(([k, t]) => el("tr", null, el("td", { class: "nowrap" }, el("kbd", null, k)), el("td", null, t))))));
  gest = partGestures({ st, id, vp, view, chip: picked, faceOfHit, editFeature: (i) => editFeature(i), editIface: (iid) => editIface(iid), showKeys });
  function onHover(hit) {
    if (!hit || !hit.face) { hover.classList.add("hidden"); return; }
    const f = hit.face, p = hit.local.map((x) => fmt(x, 1)).join(" ; ");
    hover.textContent = f.type === "plane" ? `Face plane · normale ${f.n.map((x) => fmt(x, 2)).join(" ")} · point (${p})` : f.type === "cylinder" ? `Cylindre Ø${fmt(f.r * 2, 2)}${f.inner ? " (alésage)" : ""} · point (${p})` : `Surface ${f.type} · point (${p})`;
    hover.classList.remove("hidden");
  }

  /* ---------- left: parts and construction tree ---------- */
  function renderLeft() {
    clear(left);
    left.append(el("img", { class: "side-mark", src: `img/marks/${cfg.mark || cfg.key}.svg`, alt: "" }),
      el("div", { class: "side-head" }, el("h2", null, cfg.title), btn("", () => newPartDialog(cfg), { small: true, icon: "plus", tip: "Nouvelle pièce (gabarit) — ou démarrez par l'intention, dans l'Atelier" })));
    const scroll = el("div", { class: "side-scroll" });
    left.append(scroll);
    const list = el("div", { class: "side-section" }, el("h3", null, `Pièces (${parts().length})`));
    for (const p of parts()) list.append(el("a", { class: "nav-item" + (p.id === id ? " active" : ""), href: `#/${cfg.key}/${encodeURIComponent(p.id)}` },
      icon(p.family === "pcb" ? "pcb" : p.family === "extrusion" ? "extrusion" : p.step ? "step" : "part"), el("span", { class: "grow" }, p.name || p.id), el("small", null, p.id)));
    if (!parts().length) list.append(el("p", { class: "muted" }, "Aucune pièce."));
    scroll.append(list);
    if (!st.spec) return;
    const s = st.spec, tree = el("div", { class: "side-section" }, el("h3", null, el("span", { class: "grow" }, "Arbre de construction"), addFeatureButton()));
    if (s.stock) tree.append(el("button", { class: "nav-item", type: "button", onClick: () => editStock(), "data-tip": "Matière première : ce que l'on prend sur l'étagère" }, icon("stock"),
      el("span", { class: "grow" }, `Brut : ${(STOCK_FORMS[s.stock.form] || { fr: s.stock.form }).fr.toLowerCase()}`), st.built && st.built.facts.stock && !st.built.facts.stock.exact ? badge("hors série", "warn") : null));
    for (const it of s.interfaces || []) tree.append(el("button", { class: "nav-item", type: "button", onClick: () => editIface(it.id), "data-tip": "Interface : modifier" }, icon("interfaces"),
      el("span", { class: "grow" }, it.name || it.type), badge(it.side || "A", it.side === "B" ? "b" : "a")));
    (s.features || []).forEach((f, i) => {
      const fid = f.id || `f${i + 1}`, err = st.built && st.built.log.some((l) => l.feature === fid && l.level === "error");
      tree.append(el("div", { class: "nav-item" + (f.suppressed ? " off" : "") + (err ? " err" : ""), role: "button", tabindex: "0", onClick: () => editFeature(i), onKeydown: (e) => { if (e.key === "Enter") editFeature(i); } },
        icon(OP_ICON[f.op] || "part"), el("span", { class: "grow" }, f.name || FEATURE_LABEL[f.op] || f.op), el("small", null, fid),
        f.op !== "interfaces" && iconBtn(f.suppressed ? "eye-off" : "eye", f.suppressed ? "Réactiver" : "Désactiver (supprimer temporairement)", () => store.updatePart(id, (x) => { if (x.features[i].suppressed) delete x.features[i].suppressed; else x.features[i].suppressed = true; }, `${fid} ${f.suppressed ? "réactivée" : "désactivée"}`)),
        i > 0 && iconBtn("chevron-down", "Monter dans l'arbre", () => store.updatePart(id, (x) => { const [a] = x.features.splice(i, 1); x.features.splice(i - 1, 0, a); }, `${fid} montée`), "rotate(180deg)"),
        iconBtn("trash", "Supprimer", () => store.updatePart(id, (x) => { x.features.splice(i, 1); }, `${fid} supprimée`))));
    });
    scroll.append(tree);
    scroll.append(el("div", { class: "side-section" }, el("h3", null, "Pièce"),
      btn("Dupliquer", () => { const c = JSON.parse(JSON.stringify(s)); c.id = store.uniqueId(s.id); c.name = `${s.name || s.id} (copie)`; const nid = store.addPart(c, `Pièce dupliquée : ${s.id}`); go(`#/${cfg.key}/${encodeURIComponent(nid)}`); }, { small: true, icon: "copy" }), " ",
      btn("STEP", async () => { try { download(`${s.id}.step`, await kernel.step([{ key: s.id, name: `${s.id} ${s.name || ""}`.trim() }], s.id), "application/step"); } catch (e) { toast(e.message, "error"); } }, { small: true, icon: "step", tip: "Télécharger le STEP AP214 de la pièce" }), " ",
      btn("Supprimer", async () => { if (await confirmBox("Supprimer la pièce", `Supprimer ${s.id} du projet (et de ses assemblages) ? Ctrl+Z l'annule.`, "Supprimer", true)) { store.removePart(s.id); go(`#/${cfg.key}`); } }, { small: true, icon: "trash", danger: true })));
  }
  function iconBtn(name, tip, fn, transform) {
    const b = el("button", { class: "icon-btn", type: "button", "data-tip": tip, "aria-label": tip, onClick: (e) => { e.stopPropagation(); fn(); } }, icon(name));
    b.style.fontSize = "1rem"; b.style.padding = "0 .15rem"; if (transform) b.firstChild.style.transform = transform;
    return b;
  }
  function addFeatureButton() {
    return btn("", () => {
      const cards = (defs) => el("div", { class: "grid" }, Object.keys(defs).map((op) => el("button", { class: "card lift", type: "button", onClick: () => {
        m.close();
        featureDialog({ ...JSON.parse(JSON.stringify(defs[op])), id: nextFeatureId(st.spec) }, (nf) => store.updatePart(id, (x) => { x.features = x.features || []; x.features.push(nf); }, `${FEATURE_LABEL[op]} ajouté(e)`), `Nouveau : ${FEATURE_LABEL[op]}`);
      } }, icon(OP_ICON[op]), " ", el("b", null, FEATURE_LABEL[op]))));
      const m = modal("Ajouter une opération", [el("h3", null, "À l'atelier — comme le ferait l'opérateur"), cards(SHOP_DEFAULT), el("h3", { style: { marginTop: "1rem" } }, "Formes du noyau géométrique"), cards(FEATURE_DEFAULT)], { wide: true });
    }, { small: true, icon: "plus", tip: "Ajouter une opération d'atelier ou une forme (ou utilisez la baguette, Ctrl+K)" });
  }
  function editFeature(i) {
    const f = st.spec.features[i];
    if (f.op === "interfaces") { toast("Ce repère indique où la géométrie des interfaces est taillée dans l'arbre. Déplacez-le avec la flèche.", "info"); return; }
    featureDialog({ ...f, id: f.id || `f${i + 1}` }, (nf) => store.updatePart(id, (x) => { x.features[i] = nf; }, `${nf.id} modifiée`));
  }
  function editStock() {
    stockDialog(st.spec.stock, (ns) => store.updatePart(id, (x) => { if (ns) x.stock = ns; else delete x.stock; }, ns ? `${id} : matière première modifiée` : `${id} : matière première retirée`));
  }
  function editIface(iid) {
    const it = (st.spec.interfaces || []).find((x) => x.id === iid);
    if (it) interfaceDialog(it, (ni) => store.updatePart(id, (x) => { const k = x.interfaces.findIndex((q) => q.id === iid); x.interfaces[k] = ni; }, `Interface ${iid} modifiée`));
  }

  /* ---------- right: inspector ---------- */
  function renderRight() {
    clear(right);
    const tabs = [["params", "Paramètres"], ["ifaces", "Interfaces"], ["gamme", "Gamme"], ["dfx", "DFx"], ["files", "Artéfacts"], ["sheet", "Fiche"], ["json", "Fichier"], ...((cfg.tabs || []).map((t) => [t.key, t.label]))];
    const n = st.findings ? st.findings.findings.filter((f) => f.severity === "error").length : 0;
    right.append(el("div", { class: "side-head" }, el("h2", null, st.spec.name || st.spec.id)),
      el("div", { class: "subtabs", style: { margin: "0 .6rem" } }, tabs.map(([k, label]) => el("button", { class: "subtab" + (st.tab === k ? " active" : ""), type: "button", onClick: () => { st.tab = k; renderRight(); } }, label, k === "dfx" && n ? ` (${n})` : ""))));
    const body = el("div", { class: "side-scroll" });
    right.append(body);
    if (st.tab !== "gamme" && st.phase) { st.phase = null; if (st.built) paint(st.built); }      // leaving the routing sheet : back to the finished part
    const ctx = { st, id, live, rebuild, vp, editIface, editStock, cfg, paint, overlays };
    const custom = (cfg.tabs || []).find((t) => t.key === st.tab);
    if (custom) custom.render(body, ctx);
    else ({ params: paramsPanel, ifaces: interfacesPanel, gamme: gammePanel, files: artifactsPanel, dfx: dfxPanel, sheet: sheetPanel, json: jsonPanel })[st.tab](body, ctx);
  }

  return () => { offChange(); st.token++; app.faces = null; vp.dispose(); kernel.forget(`${id}~live`).catch(() => {}); };
}

/** Gallery of starter parts. */
export function newPartDialog(cfg = {}) {
  const list = TEMPLATES.filter((t) => !cfg.templates || cfg.templates.includes(t.key));
  const m = modal("Nouvelle pièce", [el("p", { class: "muted" }, "Un gabarit est une pièce paramétrique complète, avec ses interfaces. Pour une pièce sur mesure, passez par l'Atelier : elle naît de son intention."),
    el("div", { class: "grid" }, list.map((t) => el("button", { class: "card lift", type: "button", onClick: () => {
      m.close();
      const id = store.addPart(fromTemplate(t.key, store.nextPartId()), `Pièce créée depuis le gabarit « ${t.title} »`);
      const spec = store.part(id);
      go(`#/${spec.family === "pcb" ? "pcb" : spec.family === "extrusion" ? "extrusion" : "parts"}/${encodeURIComponent(id)}`);
    } }, el("h3", null, icon(t.icon), " ", t.title), el("p", { class: "muted", style: { margin: 0 } }, t.text)))),
    el("div", { class: "form-actions" }, el("a", { class: "btn btn-primary", href: "#/shop", onClick: () => m.close() }, icon("wizard"), "Plutôt démarrer par l'intention"))], { wide: true });
}
