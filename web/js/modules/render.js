/* DesignWizard.ai — Studio photo : a picture of the product, taken as in a studio. Left, what is entered : the set (a studio,
   a desert, a street, a deck…), how large the product looks in it, the point of view, the picture. Centre, the product in its
   set under its lamps — the mouse turns around it, a click chooses a part, a lamp is taken and pulled around the product ; the
   picture refines itself as soon as nothing moves. Right, what is chosen and obtained : the lighting (a setup, the plot, each
   lamp) or the finish of each part, and the picture as a PNG with the mark of the platform. The labels of the assembly are
   on it. The rules : core/render_looks.js, core/photo_sets.js, core/photo_lights.js ; the stage : core/render_stage.js.
   Route : #/render/<assembly> — opened from the Assembly (« Photo »). */
import { el, clear, icon, svg, btn, badge, field, toast, modal, copyText, download } from "../core/dom.js";
import { registerModule, go, setStatus, setGuide } from "../core/app.js";
import { store } from "../core/store.js";
import { buildAssembly } from "../core/asm_scene.js";
import { flatAsm } from "../core/asm_levels.js";
import { RenderStage } from "../core/render_stage.js";
import { rasterLabel } from "../core/label_raster.js";
import { labelPatch } from "../core/labels.js";
import { toDwiz } from "../core/dwiz.js";
import { aiRead, aiDiff } from "../core/ai_loop.js";
import { guideBox, nudge } from "../core/guide.js";
import { busyVeil, underVeil } from "../core/busy.js";
import { setGroups, setColors, SETS } from "../core/photo_sets.js";
import { LIGHT_SETUPS, LIGHT_KINDS, addLight, copyLight, tidyLights } from "../core/photo_lights.js";
import { lightsPanel } from "./render_lights.js";
import { FINISH_GROUPS, FINISHES, SHOTS, SIZES, QUALITY, renderOf, renderLights, bodyLook, lookRows, renderGuide, tidyRender } from "../core/render_looks.js";

const pic = (...kids) => svg("svg", { viewBox: "0 0 48 30", width: 64, height: 40, class: "cf-icon", "aria-hidden": "true" }, ...kids.flat(Infinity));
/* a set : its sky as a small sheet, what its ground is made of, what says where one is, and the product as a pebble with its shadow */
const WHERE = {
  desert: (g) => [svg("path", { d: "M3 20 Q12 11 21 18 T45 15 V27 H3 Z", fill: g, stroke: "currentColor", "stroke-width": 0.7 }), svg("path", { d: "M3 23 Q16 17 30 23 T45 21", fill: "none", stroke: "#a98452", "stroke-width": 0.8 })],
  country: (g) => [svg("path", { d: "M3 19 Q16 14 28 18 T45 16 V27 H3 Z", fill: g }), svg("path", { d: "M38 17 V11", stroke: "#5d4631", "stroke-width": 1.2 }), svg("circle", { cx: 38, cy: 9.5, r: 3.6, fill: "#3f6f31" })],
  snow: (g) => [svg("path", { d: "M3 19 Q18 16 30 19 T45 18 V27 H3 Z", fill: g, stroke: "#b8c4d0", "stroke-width": 0.7 }), svg("path", { d: "M37 18 L40 8 L43 18 Z", fill: "#2c4a36" })],
  seaside: (g, w) => [svg("rect", { x: 3, y: 15, width: 42, height: 6, fill: w }), svg("path", { d: "M3 20 Q20 17 45 22 V27 H3 Z", fill: g })],
  boat: (g, w) => [svg("rect", { x: 3, y: 15, width: 42, height: 12, fill: w }), svg("path", { d: "M6 27 L10 19 H38 L42 27 Z", fill: g, stroke: "#6b4a2c", "stroke-width": 0.8 }), svg("path", { d: "M13 27 L15 19 M21 27 L22 19 M29 27 L28 19 M36 27 L34 19", stroke: "#6b4a2c", "stroke-width": 0.6 })],
  carrier: (g, w) => [svg("rect", { x: 3, y: 16, width: 42, height: 11, fill: w }), svg("path", { d: "M3 27 L8 18 H45 V27 Z", fill: g }), svg("path", { d: "M10 24 H16 M20 24 H26 M30 24 H36", stroke: "#f0efe9", "stroke-width": 1 }), svg("path", { d: "M33 18 V12 H39 V18 M36 12 V8", fill: "#8b9197", stroke: "#5a6067", "stroke-width": 0.8 })],
  city: (g) => [svg("path", { d: "M5 20 V9 H12 V20 M13 20 V5 H21 V20 M30 20 V7 H37 V20 M38 20 V11 H44 V20", fill: "#a9aeb5", stroke: "#6d7480", "stroke-width": 0.7 }), svg("rect", { x: 3, y: 20, width: 42, height: 7, fill: g }), svg("path", { d: "M6 24 H12 M17 24 H23 M36 24 H42", stroke: "#e3c84a", "stroke-width": 0.9 })],
  roof: (g) => [svg("path", { d: "M5 20 V13 H10 V20 M12 20 V10 H17 V20 M33 20 V11 H38 V20 M40 20 V14 H44 V20", fill: "#9da3ab" }), svg("path", { d: "M3 27 V19 H45 V27 Z", fill: g, stroke: "#8c8a84", "stroke-width": 1 })],
};
const setPic = (id) => { const [top, hor, g, w] = setColors(id), f = WHERE[id]; return pic(svg("defs", null, svg("linearGradient", { id: `sky-${id}`, x1: 0, y1: 0, x2: 0, y2: 1 }, svg("stop", { offset: 0, "stop-color": top }), svg("stop", { offset: 0.72, "stop-color": hor }))),
  svg("rect", { x: 3, y: 3, width: 42, height: 24, fill: `url(#sky-${id})` }), f ? f(g, w) : svg("path", { d: "M3 21 Q24 18 45 21 V27 H3 Z", fill: g }), svg("ellipse", { cx: 26, cy: 23.6, rx: 8, ry: 1.5, fill: "#000", "fill-opacity": 0.3 }), svg("rect", { x: 18, y: 14, width: 11, height: 9, rx: 2.4, fill: "var(--dom)", stroke: "#fff", "stroke-width": 0.8 }),
  svg("rect", { x: 3, y: 3, width: 42, height: 24, rx: 3, fill: "none", stroke: "currentColor", "stroke-width": 1 })); };
/* a point of view : the product as a box, the eye as a small camera where it stands */
const EYE = { hero: [9, 9], road: [7, 20], side: [5, 17], front: [24, 4], low: [9, 25], top: [11, 4] };
const shotPic = (k) => { const [x, y] = EYE[k] || EYE.hero; return pic(svg("rect", { x: 26, y: 11, width: 15, height: 12, rx: 2, fill: "currentColor", "fill-opacity": 0.16, stroke: "currentColor", "stroke-width": 1.3 }),
  svg("path", { d: `M${x + 3} ${y} L27 17`, fill: "none", stroke: "var(--dom)", "stroke-width": 1.2, "stroke-dasharray": "2 2" }), svg("circle", { cx: x, cy: y, r: 3.4, fill: "var(--dom)" })); };
/* a finish : a ball that shows how it answers light — a sharp or a soft highlight, a pattern, a see-through body */
function finishPic(id, color) {
  const F = FINISHES[id], c = F.own || (F.tint ? color : F.group === "metal" ? "#b9c2ca" : color), gid = `fb${id.replace(/\W/g, "")}`, hi = 1 - F.rough;
  return svg("svg", { viewBox: "0 0 30 30", width: 34, height: 34, "aria-hidden": "true" }, svg("defs", null, svg("radialGradient", { id: gid, cx: 0.36, cy: 0.3, r: 0.75 }, svg("stop", { offset: 0, "stop-color": "#ffffff", "stop-opacity": 0.25 + 0.7 * hi }), svg("stop", { offset: 0.12 + 0.5 * F.rough, "stop-color": c, "stop-opacity": F.opacity ? 0.45 : 1 }), svg("stop", { offset: 1, "stop-color": F.metal > 0.5 ? "#30363d" : c, "stop-opacity": F.opacity ? 0.3 : 1 }))),
    svg("circle", { cx: 15, cy: 15, r: 12, fill: `url(#${gid})`, stroke: "currentColor", "stroke-opacity": 0.45, "stroke-width": 1, ...(F.opacity ? { "stroke-dasharray": "3 2" } : {}) }),
    ...(F.pattern === "brushed" ? [7, 11, 15, 19, 23].map((y) => svg("path", { d: `M${5 + Math.abs(15 - y) * 0.5} ${y} H${25 - Math.abs(15 - y) * 0.5}`, stroke: "#ffffff", "stroke-opacity": 0.4, "stroke-width": 0.7 })) : []),
    ...(F.pattern === "weave" ? [svg("path", { d: "M8 8 L22 22 M12 6 L24 18 M6 12 L18 24 M22 8 L8 22 M18 6 L6 18 M24 12 L12 24", stroke: "#ffffff", "stroke-opacity": 0.28, "stroke-width": 0.8 })] : []),
    ...(F.pattern === "grain" || F.pattern === "flakes" ? [[10, 11], [18, 9], [14, 17], [21, 16], [11, 21], [18, 22]].map(([x, y]) => svg("circle", { cx: x, cy: y, r: 0.7, fill: "#ffffff", "fill-opacity": F.pattern === "flakes" ? 0.8 : 0.35 })) : []));
}
const tile = (o) => el("button", { class: `cf-tile${o.sel ? " sel" : ""}`, type: "button", "aria-pressed": o.sel ? "true" : "false", "data-tip": o.tip || null, style: `--dom:${o.color}`, onClick: o.run, ...o.data }, o.pic, el("b", null, o.label));
const request = (asm, rows) => ["Tu es l'assistant de conception de DesignWizard.ai. Voici la séance photo d'un produit : seul le bloc « render » se modifie.",
  "ENTREVUE — pose-moi au plus cinq questions, une à la fois : à qui l'image s'adresse, où l'on veut voir le produit (studio, désert, mer, ville, campagne…), l'heure et l'ambiance de la lumière, les couleurs de la marque, les pièces à mettre en valeur. Puis résume en trois lignes et attends mon accord.",
  `RÉPONSE ATTENDUE — un seul bloc \`\`\`dwiz avec l'assemblage entier, bloc « render » à jour : scene (${Object.keys(SETS).join(", ")}), shot (${Object.keys(SHOTS).join(", ")}), size (${Object.keys(SIZES).join(", ")}), quality (${Object.keys(QUALITY).join(", ")}), scale (0.4 à 2.5 : la taille du produit dans le décor), exposure (−2 à 2 crans), ground et labels (true ou false) ; l'éclairage : setup (${Object.keys(LIGHT_SETUPS).join(", ")}) et ambient (0 à 1.5), ou des lignes « light » placées à la main — id, kind (${Object.keys(LIGHT_KINDS).join(", ")}), az (autour du produit, degrés), el (hauteur, 0 à 90), power (0 à 6), soft (0 à 1), kelvin (2000 à 10000), shadow ; et une ligne « look » par pièce habillée : sa référence, finish (${Object.keys(FINISHES).join(", ")}), color (« #rrggbb », pour une peinture ou une anodisation). N'invente aucune pièce.`,
  "", `Pièces : ${rows.map((r) => `${r.part} ${r.name} (${r.label})`).join(" ; ")}.`, "", toDwiz(asm).trimEnd()].join("\n");
function render(main, args) {
  const list = store.assemblies, id = args[0] && store.assembly(args[0]) ? args[0] : (list[0] && list[0].id) || null;
  const left = el("aside", { class: "side" }), right = el("aside", { class: "side right" }), view = el("div", { class: "viewport rd-view" }), root = el("div", { class: "studio" }, left, view, right);
  root.style.setProperty("--right-w", "400px"); main.append(root);
  if (!id) { root.classList.add("no-right"); right.remove(); left.append(el("div", { class: "side-head" }, el("h2", null, "Studio photo")));
    view.append(el("div", { class: "page" }, el("div", { class: "empty" }, el("h2", null, "Une photo du produit"), el("p", null, "Ouvrez un projet qui a un assemblage : le studio en fait une image, dans un décor et sous des lumières que vous placez."), btn("Voir les exemples", () => go("#/home"), { primary: true, icon: "home" })))); return null; }
  const st = { sel: null, ctx: null, alive: true, token: 0, free: null, tab: "lights", light: null, lamps: true, plot: null }, asm = () => store.assembly(id), R = () => renderOf(asm());
  const change = (label, fn) => store.updateAssembly(id, (a) => { const x = renderOf(a); fn(x); a.render = tidyRender(x); }, label);
  /* the lights of a render, to change one of them : a setup that was followed becomes lights of one's own, where they stand now */
  const own = (x) => { if (!Array.isArray(x.lights)) { const L = renderLights(x); x.lights = L.lights; if (x.ambient === null || x.ambient === undefined) x.ambient = L.ambient; } return x.lights; };
  const oneLight = (lid, label, fn) => change(label, (x) => { const l = own(x).find((q) => q.id === lid); if (l) fn(l); x.lights = tidyLights(x.lights); });
  const open = () => flatAsm(asm(), (x) => store.assembly(x));      // the assembly opened : every part through its sub-assemblies, with the settings of the render
  const names = () => Object.fromEntries(open().instances.map((i) => [i.part, (store.part(i.part) || {}).name || i.part]));
  const status = el("div", { class: "view-status" }), info = el("span", { class: "chip" }, "—"), fine = el("span", { class: "chip", "data-refine": "" }, "—"), hint = el("span", { class: "chip" }, "Glisser : tourner · molette : approcher · Maj + glisser : déplacer · clic : choisir une pièce · une lampe se prend et se tire autour du produit"); status.append(info, fine, hint); view.append(status);
  const veil = busyVeil(view);
  const stage = new RenderStage(view, { onPick: (pid, data) => { st.sel = data && data.part ? data.part : null; if (st.sel) st.tab = "looks"; renderRight(); glow(); }, onView: (v) => { st.free = v; renderLeft(); if (st.tab === "lights") renderRight(); },
    onLight: (lid, a, phase) => { if (phase === "take") { st.light = lid; st.tab = "lights"; renderRight(); } else if (phase === "move") { if (st.plot && a) st.plot.place(lid, a.az, a.el); } else if (a) oneLight(lid, "Lumière déplacée", (l) => Object.assign(l, a)); },
    onRefine: (done, total) => { fine.textContent = total < 2 ? "Image simple" : done >= total ? "Image affinée" : `Affinage ${done} / ${total}`; fine.className = `chip${done >= total ? " done" : " busy"}`; } });
  view._stage = stage;                                                 // for whoever inspects the page (tests, the console)
  const glow = () => stage.highlight(st.sel && st.ctx ? open().instances.filter((i) => i.part === st.sel).flatMap((i) => (st.ctx.built[i.part] ? st.ctx.built[i.part].bodies.map((b) => `${i.id}/${b.name}`) : [])) : []);
  const guide = () => renderGuide(asm(), [...new Set(open().instances.map((i) => i.part))]).map((x) => ({ ...x, go: () => { if (x.field === "lights") { st.tab = "lights"; if (x.id) st.light = x.id; renderRight(); } else if (x.id && st.ctx && st.ctx.built[x.id]) { st.tab = "looks"; st.sel = x.id; renderRight(); glow(); }
    const f = x.field === "lights" ? right.querySelector(x.id ? `[data-light-row="${x.id}"]` : ".lt-plot") : x.field === "looks" ? right.querySelector("[data-part-card], [data-looks]") : left.querySelector(`[data-box="${x.field}"]`); if (f) nudge(f); } }));
  /* everything that stands on the stage : each body of each instance in its finish, then the labels ; then the set and the lamps */
  async function dress(keepView = true) {
    const token = ++st.token, ctx = st.ctx, r = R(); if (!ctx) return;
    const items = [];
    for (const inst of ctx.asm.instances) { if (inst.hidden) continue; const b = ctx.built[inst.part]; for (const body of b.bodies) items.push({ id: `${inst.id}/${body.name}`, mesh: body.mesh, matrix: ctx.sol.placements[inst.id], look: bodyLook(body, r.looks[inst.part], b.main, inst.look), data: { inst: inst.id, part: inst.part, body: body.name } }); }
    if (r.labels) for (const l of asm().labels || []) { const m = l.on && l.inst && ctx.sol.placements[l.inst], mesh = m && labelPatch(l), map = mesh && await rasterLabel(l); if (token !== st.token || !st.alive) return; if (map) items.push({ id: `label/${l.id}`, mesh, map, matrix: m, data: { label: l.id } }); }
    const view0 = stage.viewNow(), target0 = stage.view.target.clone(), L = renderLights(r);
    stage.setScene(r.scene, r.ground, r.scale); stage.setContent(items, ctx.bbox); stage.setLights(L.lights, L.ambient, st.light); stage.setSamples(QUALITY[r.quality].n); stage.setExposure(r.exposure); stage.showLamps(st.lamps && st.tab === "lights");
    if (keepView && st.free) { Object.assign(stage.view, view0); stage.view.target.copy(target0); } else if (r.view) { stage.setShot({ ...r.view, fill: 0.82 }); stage.view.dist = r.view.dist; } else stage.setShot(SHOTS[r.shot] || SHOTS.hero);
    glow(); const rows = lookRows(open(), ctx.built, names()); info.textContent = `${ctx.asm.instances.length} pièce(s) · ${SETS[r.scene].fr.toLowerCase()} · ${L.own ? "lumières placées à la main" : LIGHT_SETUPS[L.setup].label} · ${rows.filter((x) => x.chosen).length} finition(s) choisie(s) · ${(asm().labels || []).filter((l) => l.on).length} étiquette(s)`;
  }
  async function build() { setStatus("Construction de l'assemblage…", "busy");
    try { const ctx = await buildAssembly(asm(), (t) => setStatus(t, "busy")); if (!st.alive) return; st.ctx = ctx; setStatus(`${id} prêt`, "done"); await dress(false); renderRight(); }
    catch (e) { setStatus(e.message, "error"); } }
  /* the picture : refined as many times as the quality asks, under a veil that says where it stands and lets one give up */
  async function shoot() {
    const r = R(), S = SIZES[r.size] || SIZES.hd, n = QUALITY[r.quality].n; setStatus("Image en cours…", "busy");
    try {
      const c = await underVeil(veil, `Image de ${S.w} × ${S.h} — ${n} passes…`, (say, signal) => stage.shoot(S.w, S.h, { shot: st.free ? null : r.view ? null : SHOTS[r.shot], samples: n, onStep: (done, total) => say(`Image de ${S.w} × ${S.h} — passe ${done} sur ${total}`, done, total), stop: () => signal.off }), { kernel: false, cancelled: "Image annulée : rien n'a été enregistré." });
      if (!c) { setStatus(`${id} prêt`, "done"); return; }
      const blob = await new Promise((ok) => c.toBlob(ok, "image/png")); if (!blob) { toast("L'image n'a pas pu être faite.", "error"); return; }
      download(`${id}_photo_${r.scene}_${S.w}x${S.h}.png`, blob, "image/png"); setStatus(`Image de ${S.w} × ${S.h} enregistrée`, "done"); toast(`Image de ${S.w} × ${S.h} pixels enregistrée, avec la marque de la plateforme.`, "success", 5000);
    } catch (e) { setStatus(e.message, "error"); toast(e.message, "error", 7000); }
  }
  function reimport() {
    const area = el("textarea", { rows: 9, placeholder: "Collez la réponse de l'assistant : elle contient l'assemblage dans un bloc ```dwiz." }), out = el("div"); let next = null;
    const ok = btn("Appliquer ces changements", () => { if (!next) return; st.free = null; store.updateAssembly(id, (a) => { a.render = next; }, "Séance photo mise à jour par l'IA"); m.close(); toast("Séance photo réécrite depuis la réponse de l'IA.", "success"); }, { primary: true, icon: "check", disabled: true });
    area.addEventListener("input", () => { next = null; ok.disabled = true; out.replaceChildren(); if (!area.value.trim()) return;
      try { const doc = aiRead(area.value); if (!doc || !doc.render) throw new Error("La réponse ne contient pas de bloc « render »."); const d = tidyRender(doc.render), diff = aiDiff(tidyRender(R()), d);
        out.append(el("p", null, diff.length ? `${diff.length} changement(s) :` : "Aucun changement dans la séance photo."), el("ul", { class: "decisions" }, diff.slice(0, 30).map((x) => el("li", null, `${x.path} — ${x.text}`))), guideBox(renderGuide({ render: d }, [...new Set(asm().instances.map((i) => i.part))]).filter((x) => x.level !== "tip"), { title: "Ce que cette réponse laisse à régler" }) || "");
        if (diff.length) { next = d; ok.disabled = false; }
      } catch (e) { out.append(el("p", { class: "form-error" }, e.message)); } });
    const m = modal("Réimporter la séance photo depuis une IA", [field("Réponse de l'assistant", area), out, el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), ok)], { wide: true });
  }
  function renderLeft() {
    clear(left); const r = R(), S = SETS[r.scene], take = btn("Faire l'image (.png)", shoot, { primary: true, icon: "camera", tip: "L'image au format choisi, affinée, avec la marque de la plateforme dans le coin" }); take.dataset.shoot = "";
    left.append(el("div", { class: "side-head" }, el("h2", null, "Studio photo"), el("a", { class: "btn btn-small", href: `#/assembly/${encodeURIComponent(id)}`, "data-tip": "Revenir à l'assemblage" }, icon("assembly")), el("a", { class: "btn btn-small", href: `#/labels/${encodeURIComponent(id)}`, "data-tip": "Étiquettes et autocollants de cet assemblage" }, icon("edit"))),
      el("div", { class: "side-actions" }, take));
    const scroll = el("div", { class: "side-scroll" }); left.append(scroll);
    if (list.length > 1) scroll.append(el("div", { class: "side-section", "data-fold-note": `${list.length}` }, el("h3", null, "L'assemblage"), list.map((a) => el("a", { class: "nav-item" + (a.id === id ? " active" : ""), href: `#/render/${encodeURIComponent(a.id)}` }, icon("assembly"), el("span", { class: "grow" }, a.name || a.id)))));
    scroll.append(el("div", { class: "side-section", "data-box": "scene", "data-fold-note": S.fr }, el("h3", null, "Le décor"),
      setGroups().map((G) => [el("p", { class: "ft-label rd-group", style: `--dom:${G.color}` }, G.fr), el("div", { class: "cf-tiles" }, G.items.map((x) => tile({ sel: x.id === r.scene, color: G.color, label: x.fr, tip: x.text, pic: setPic(x.id), data: { "data-scene": x.id }, run: () => change(`Décor : ${x.fr.toLowerCase()}`, (y) => { y.scene = x.id; }) })))]),
      el("div", { class: "form-row tight" }, field("Taille du produit dans le décor (%)", el("input", { type: "number", min: 40, max: 250, step: 10, value: Math.round(r.scale * 100), "data-scale": "", onChange: (e) => { const v = Math.max(40, Math.min(250, Number(e.target.value) || 100)); change("Taille du produit dans le décor", (y) => { y.scale = v / 100; }); } }), "Le décor se met à l'échelle du produit : ce n'est pas un lieu mesuré")),
      S.room ? el("label", { class: "check small" }, el("input", { type: "checkbox", checked: r.ground, onChange: (e) => change("Sol du studio", (y) => { y.ground = e.target.checked; }) }), "Un sol sous le produit (il reçoit son ombre)") : null));
    scroll.append(el("div", { class: "side-section", "data-box": "shot", "data-fold-note": st.free ? "à la souris" : r.view ? "gardé" : (SHOTS[r.shot] || SHOTS.hero).fr }, el("h3", null, "Le point de vue"), el("div", { class: "cf-tiles" }, Object.entries(SHOTS).map(([k, V]) => tile({ sel: !st.free && !r.view && k === r.shot, color: "#0c66e4", label: V.fr, tip: V.text, pic: shotPic(k), data: { "data-shot": k }, run: () => { st.free = null; change(`Point de vue : ${V.fr.toLowerCase()}`, (x) => { x.shot = k; x.view = null; }); } }))),
      st.free ? el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, btn("Garder ce point de vue", () => { const v = st.free; change("Point de vue gardé", (x) => { x.view = v; }); }, { small: true, icon: "check", tip: "Le point de vue réglé à la souris est gardé avec l'assemblage" })) : r.view ? el("p", { class: "muted small" }, "Point de vue gardé — un clic sur une vignette revient à une vue de la liste.") : null));
    scroll.append(el("div", { class: "side-section", "data-box": "size", "data-fold-note": (SIZES[r.size] || SIZES.hd).fr }, el("h3", null, "L'image"),
      el("div", { class: "form-row tight" }, field("Format", el("select", { "data-size": "", onChange: (e) => change("Format de l'image", (x) => { x.size = e.target.value; }) }, Object.entries(SIZES).map(([k, V]) => el("option", { value: k, selected: k === r.size }, `${V.fr} — ${V.w} × ${V.h}`))))),
      el("div", { class: "form-row tight" }, field("Finesse", el("select", { "data-quality": "", onChange: (e) => change("Finesse de l'image", (x) => { x.quality = e.target.value; }) }, Object.entries(QUALITY).map(([k, Q]) => el("option", { value: k, selected: k === r.quality }, `${Q.fr} — ${Q.n} passes`))), QUALITY[r.quality].text),
        field("Exposition (crans)", el("input", { type: "number", min: -2, max: 2, step: 0.25, value: r.exposure, "data-exposure": "", onChange: (e) => { const v = Math.max(-2, Math.min(2, Number(e.target.value) || 0)); change("Exposition de l'image", (x) => { x.exposure = v; }); } }), "+1 : deux fois plus clair")),
      el("label", { class: "check small" }, el("input", { type: "checkbox", checked: r.labels, onChange: (e) => change("Étiquettes dans l'image", (x) => { x.labels = e.target.checked; }) }), "Montrer les étiquettes et autocollants")));
    const g = guideBox(guide(), { title: "Ce que la photo demande", quiet: "Décor, lumières, point de vue et finitions : prêts." }); if (g) scroll.append(el("div", { class: "side-section" }, el("h3", null, "À régler"), g));
    scroll.append(el("div", { class: "side-section" }, el("h3", null, "Avec une IA"), el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } },
      btn("Copier pour une IA", async () => toast((await copyText(request(asm(), st.ctx ? lookRows(open(), st.ctx.built, names()) : []))) ? "Copié : la séance photo et sa consigne." : "Copie impossible.", "success", 5000), { small: true, icon: "sparkle", tip: "La séance photo, précédée de la façon de mener l'entrevue et de la réponse attendue" }),
      btn("Réimporter…", reimport, { small: true, icon: "wizard", tip: "Aperçu des changements, puis une seule étape annulable" }))));
  }
  function card(row) {
    const r = R(), cur = r.looks[row.part] || {}, F = FINISHES[row.finish], pick = (k) => change(`${row.part} : ${FINISHES[k].label.toLowerCase()}`, (x) => { x.looks[row.part] = { finish: k, ...(FINISHES[k].tint ? { color: (x.looks[row.part] || {}).color || row.color } : {}) }; });
    return el("div", { class: "card taped ft-card", "data-part-card": row.part },
      ...FINISH_GROUPS.map((G) => [el("p", { class: "ft-label rd-group", style: `--dom:${G.color}` }, G.label), el("div", { class: "cf-tiles rd-finishes" }, Object.entries(FINISHES).filter(([, f]) => f.group === G.id).map(([k, f]) => tile({ sel: row.chosen && k === row.finish, color: G.color, label: f.label, tip: f.text, pic: finishPic(k, row.color), data: { "data-finish": k }, run: () => pick(k) })))]).flat(),
      el("div", { class: "form-row tight" }, F.tint ? field("Sa couleur", el("input", { type: "color", value: row.color, "data-look-color": "", onChange: (e) => change(`${row.part} : couleur`, (x) => { x.looks[row.part] = { finish: row.finish, color: e.target.value }; }) })) : el("p", { class: "muted small", style: { margin: 0 } }, "Cette finition montre la couleur de la matière.")),
      el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, cur.finish ? btn("Revenir à la matière", () => change(`${row.part} : finition de la matière`, (x) => { delete x.looks[row.part]; }), { small: true, icon: "refresh", tip: "Retire le choix : la pièce montre la finition de sa matière" }) : el("small", { class: "muted" }, "Finition de la matière — rien n'est choisi.")));
  }
  function looksTab(body) {
    body.dataset.looks = "";
    if (!st.ctx) { body.append(el("p", { class: "atelier-hint" }, icon("info"), " Construction de l'assemblage…")); return; }
    const rows = lookRows(open(), st.ctx.built, names());
    for (const G of FINISH_GROUPS) { const mine = rows.filter((x) => x.group === G.id); if (!mine.length) continue;
      body.append(el("div", { class: "ft-group", style: `--dom:${G.color}`, "data-finish-group": G.id }, el("div", { class: "lib-group-head" }, el("b", null, G.label), el("small", null, ""), el("span", { class: "lib-count" }, String(mine.length))),
        mine.map((row) => { const on = row.part === st.sel; return [el("button", { class: `ft-row${on ? " sel" : ""}`, type: "button", "data-part": row.part, "aria-expanded": on ? "true" : "false", style: `--dom:${G.color}`, onClick: () => { st.sel = on ? null : row.part; renderRight(); glow(); } }, finishPic(row.finish, row.color),
          el("span", { class: "ft-name" }, el("b", null, row.name), el("small", null, `${row.label}${row.qty > 1 ? ` · × ${row.qty}` : ""} · ${row.part}`)), row.chosen ? badge("choisie", "info") : null), on ? card(row) : null]; }))); }
    body.append(el("p", { class: "muted small" }, "Une finition habille toutes les instances d'une pièce. Les finitions sont des réglages d'image, pas des finitions d'atelier. ", el("a", { href: "#/help/sources/project" }, "Sources")));
  }
  function lightsTab(body) {
    const r = R(), L = renderLights(r), camAz = stage.viewNow().az;
    const P = lightsPanel({ ...L, camAz, sel: st.light, lamps: st.lamps,
      pickSetup: (k) => change(`Éclairage : ${LIGHT_SETUPS[k].label}`, (x) => { x.setup = k; x.lights = null; x.ambient = null; }), backToSet: () => change("Éclairage tout fait", (x) => { x.lights = null; x.ambient = null; }),
      setAmbient: (v) => change("Lumière d'ambiance", (x) => { x.ambient = v; }),
      move: (lid, a, done) => { if (done) oneLight(lid, "Lumière déplacée", (l) => Object.assign(l, a)); else stage.moveLight(lid, a); },
      patch: (lid, patch, label) => oneLight(lid, label, (l) => Object.assign(l, patch)), toggle: (lid, on) => oneLight(lid, `Lumière ${on ? "à On" : "à Off"}`, (l) => { if (on) delete l.off; else l.off = true; }),
      copy: (lid) => change("Lumière copiée", (x) => { x.lights = copyLight(own(x), lid); }), drop: (lid) => { if (st.light === lid) st.light = null; change("Lumière retirée", (x) => { x.lights = own(x).filter((l) => l.id !== lid); }); },
      add: (kind) => change(`Lumière ajoutée : ${LIGHT_KINDS[kind].label}`, (x) => { const before = new Set(own(x).map((l) => l.id)); x.lights = addLight(x.lights, kind, camAz); const made = x.lights.find((l) => !before.has(l.id)); if (made) st.light = made.id; }),
      select: (lid) => { st.light = lid; stage.selectLight(lid); renderRight(); }, showLamps: (on) => { st.lamps = on; stage.showLamps(on); } });
    st.plot = P.plot; body.append(...P.nodes, el("p", { class: "muted small", style: { margin: ".4rem .6rem" } }, "Les lumières sont des réglages d'image : puissance et température sont relatives, pas des mesures. ", el("a", { href: "#/help/sources/project" }, "Sources")));
  }
  function renderRight() {
    clear(right); st.plot = null;
    right.append(el("div", { class: "side-head" }, el("h2", null, st.tab === "lights" ? "Lumières" : "Finitions")), el("div", { class: "subtabs", style: { margin: "0 .6rem" }, role: "tablist" }, [["lights", "Lumières"], ["looks", "Finitions"]].map(([k, l]) => el("button", { class: "subtab" + (st.tab === k ? " active" : ""), type: "button", role: "tab", "aria-selected": st.tab === k ? "true" : "false", "data-tab": k, onClick: () => { st.tab = k; renderRight(); } }, l))));
    const body = el("div", { class: "side-scroll" }); right.append(body); stage.showLamps(st.lamps && st.tab === "lights");
    if (st.tab === "lights") lightsTab(body); else looksTab(body);
  }
  const refresh = () => { renderLeft(); renderRight(); setGuide(guide()); };
  const off = store.on("change", () => { if (!store.assembly(id)) { go("#/render"); return; } refresh(); dress(true); });
  refresh(); build();
  return () => { st.alive = false; off(); st.token++; setGuide([]); veil.dispose(); stage.dispose(); };
}
registerModule({ key: "render", label: "Studio photo", icon: "camera", tip: "Studio photo : le produit dans un décor, sous des lumières que l'on place, avec la finition de chaque pièce — et son image", render });
