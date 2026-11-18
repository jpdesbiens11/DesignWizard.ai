/* DesignWizard.ai — Rendu : a marketing picture of the product. Left, what is entered : the scene, the point of view, the
   size of the picture. Centre, the product under studio light — the mouse turns around it, a click chooses a part. Right,
   what is chosen and obtained : the finish of each part, grouped by nature (paints, metals, plastics, composites, clear
   shells), its colour, and the picture as a PNG with the mark of the platform. The labels of the assembly are on it.
   The rules : core/render_looks.js ; the stage : core/render_stage.js. Route : #/render/<assembly>. */

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
import { FINISH_GROUPS, FINISHES, SCENES, SHOTS, SIZES, renderOf, bodyLook, lookRows, renderGuide, tidyRender } from "../core/render_looks.js";

const pic = (...kids) => svg("svg", { viewBox: "0 0 48 30", width: 64, height: 40, class: "cf-icon", "aria-hidden": "true" }, ...kids.flat(Infinity));
/* a scene : its sky as a small sheet, the product as a pebble, its shadow */
const scenePic = (S) => pic(svg("defs", null, svg("linearGradient", { id: `sky${S.sky[0].slice(1)}`, x1: 0, y1: 0, x2: 0, y2: 1 }, svg("stop", { offset: 0, "stop-color": S.sky[0] }), svg("stop", { offset: 1, "stop-color": S.sky[1] }))),
  svg("rect", { x: 3, y: 3, width: 42, height: 24, rx: 3, fill: `url(#sky${S.sky[0].slice(1)})`, stroke: "currentColor", "stroke-width": 1 }), svg("ellipse", { cx: 24, cy: 22.5, rx: 11, ry: 2, fill: "#000", "fill-opacity": 0.22 }), svg("rect", { x: 17, y: 9, width: 14, height: 13, rx: 3, fill: "var(--dom)" }));
/* a point of view : the product as a box, the eye as a small camera where it stands */
const EYE = { hero: [9, 9], side: [5, 17], front: [24, 4], low: [9, 25], top: [11, 4] };
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
const request = (asm, rows) => ["Tu es l'assistant de conception de DesignWizard.ai. Voici le rendu marketing d'un produit : seul le bloc « render » se modifie.",
  "ENTREVUE — pose-moi au plus cinq questions, une à la fois : à qui l'image s'adresse, l'ambiance voulue (studio clair, sombre, plein air), les couleurs de la marque, les pièces à mettre en valeur. Puis résume en trois lignes et attends mon accord.",
  `RÉPONSE ATTENDUE — un seul bloc \`\`\`dwiz avec l'assemblage entier, bloc « render » à jour : scene (${Object.keys(SCENES).join(", ")}), shot (${Object.keys(SHOTS).join(", ")}), size (${Object.keys(SIZES).join(", ")}), ground et labels (true ou false), et une ligne « look » par pièce habillée : sa référence, finish (${Object.keys(FINISHES).join(", ")}), color « #rrggbb » pour une peinture ou une anodisation. Après le bloc, liste ce que tu as changé.`,
  "", `Pièces : ${rows.map((r) => `${r.part} ${r.name} (${r.label})`).join(" ; ")}.`, "", toDwiz(asm).trimEnd()].join("\n");

function render(main, args) {
  const list = store.assemblies, id = args[0] && store.assembly(args[0]) ? args[0] : (list[0] && list[0].id) || null;
  const left = el("aside", { class: "side" }), right = el("aside", { class: "side right" }), view = el("div", { class: "viewport rd-view" }), root = el("div", { class: "studio" }, left, view, right);
  root.style.setProperty("--right-w", "400px"); main.append(root);
  if (!id) { root.classList.add("no-right"); right.remove(); left.append(el("div", { class: "side-head" }, el("h2", null, "Rendu")));
    view.append(el("div", { class: "page" }, el("div", { class: "empty" }, el("h2", null, "Une image du produit"), el("p", null, "Ouvrez un projet qui a un assemblage : le rendu en fait une image."), btn("Voir les exemples", () => go("#/home"), { primary: true, icon: "home" })))); return null; }
  const st = { sel: null, ctx: null, alive: true, token: 0, free: null }, asm = () => store.assembly(id), R = () => renderOf(asm());
  const change = (label, fn) => store.updateAssembly(id, (a) => { a.render = tidyRender({ ...renderOf(a) }); fn(a.render); }, label);
  const open = () => flatAsm(asm(), (x) => store.assembly(x));      // the assembly opened : every part through its sub-assemblies, with the settings of the render
  const names = () => Object.fromEntries(open().instances.map((i) => [i.part, (store.part(i.part) || {}).name || i.part]));
  const status = el("div", { class: "view-status" }), info = el("span", { class: "chip" }, "—"), hint = el("span", { class: "chip" }, "Glisser : tourner · molette : approcher · Maj + glisser : déplacer · clic : choisir une pièce"); status.append(info, hint); view.append(status);
  const stage = new RenderStage(view, { onPick: (pid, data) => { st.sel = data && data.part ? data.part : null; renderRight(); glow(); }, onView: (v) => { st.free = v; renderLeft(); } });
  view._stage = stage;                                                 // for whoever inspects the page (tests, the console)
  const glow = () => stage.highlight(st.sel && st.ctx ? open().instances.filter((i) => i.part === st.sel).flatMap((i) => (st.ctx.built[i.part] ? st.ctx.built[i.part].bodies.map((b) => `${i.id}/${b.name}`) : [])) : []);
  const guide = () => renderGuide(asm(), [...new Set(open().instances.map((i) => i.part))]).map((x) => ({ ...x, go: () => { if (x.id && st.ctx && st.ctx.built[x.id]) { st.sel = x.id; renderRight(); glow(); } const f = x.field === "looks" ? right.querySelector("[data-part-card], [data-looks]") : left.querySelector(`[data-box="${x.field}"]`); if (f) nudge(f); } }));
  /* everything that stands on the stage : each body of each instance in its finish, then the labels */
  async function dress(keepView = true) {
    const token = ++st.token, ctx = st.ctx, r = R(); if (!ctx) return;
    const items = [];
    for (const inst of ctx.asm.instances) { if (inst.hidden) continue; const b = ctx.built[inst.part]; for (const body of b.bodies) items.push({ id: `${inst.id}/${body.name}`, mesh: body.mesh, matrix: ctx.sol.placements[inst.id], look: bodyLook(body, r.looks[inst.part], b.main), data: { inst: inst.id, part: inst.part, body: body.name } }); }
    if (r.labels) for (const l of asm().labels || []) { const m = l.on && l.inst && ctx.sol.placements[l.inst], mesh = m && labelPatch(l), map = mesh && await rasterLabel(l); if (token !== st.token || !st.alive) return; if (map) items.push({ id: `label/${l.id}`, mesh, map, matrix: m, data: { label: l.id } }); }
    const view0 = stage.viewNow(), target0 = stage.view.target.clone();
    stage.setScene(r.scene, r.ground); stage.setContent(items, ctx.bbox);
    if (keepView && st.free) { Object.assign(stage.view, view0); stage.view.target.copy(target0); } else if (r.view) { stage.setShot({ ...r.view, fill: 0.82 }); stage.view.dist = r.view.dist; } else stage.setShot(SHOTS[r.shot] || SHOTS.hero);
    glow(); const rows = lookRows(open(), ctx.built, names()); info.textContent = `${ctx.asm.instances.length} pièce(s) · ${rows.filter((x) => x.chosen).length} finition(s) choisie(s) · ${SCENES[r.scene].fr.toLowerCase()} · ${(asm().labels || []).filter((l) => l.on).length} étiquette(s)`;
  }
  async function build() { setStatus("Construction de l'assemblage…", "busy");
    try { const ctx = await buildAssembly(asm(), (t) => setStatus(t, "busy")); if (!st.alive) return; st.ctx = ctx; setStatus(`${id} prêt`, "done"); await dress(false); renderRight(); }
    catch (e) { setStatus(e.message, "error"); } }
  function shoot() {
    const r = R(), S = SIZES[r.size] || SIZES.hd; setStatus("Image en cours…", "busy");
    try { const c = stage.snapshot(S.w, S.h, { shot: st.free ? null : r.view ? null : SHOTS[r.shot] }); c.toBlob((blob) => { if (!blob) { toast("L'image n'a pas pu être faite.", "error"); return; } download(`${id}_rendu_${r.scene}_${S.w}x${S.h}.png`, blob, "image/png"); setStatus(`Image de ${S.w} × ${S.h} enregistrée`, "done"); toast(`Image de ${S.w} × ${S.h} pixels enregistrée, avec la marque de la plateforme.`, "success", 5000); }, "image/png"); }
    catch (e) { setStatus(e.message, "error"); toast(e.message, "error", 7000); }
  }
  function reimport() {
    const area = el("textarea", { rows: 9, placeholder: "Collez la réponse de l'assistant : elle contient l'assemblage dans un bloc ```dwiz." }), out = el("div"); let next = null;
    const ok = btn("Appliquer ces changements", () => { if (!next) return; st.free = null; store.updateAssembly(id, (a) => { a.render = next; }, "Rendu mis à jour par l'IA"); m.close(); toast("Rendu réécrit depuis la réponse de l'IA.", "success"); }, { primary: true, icon: "check", disabled: true });
    area.addEventListener("input", () => { next = null; ok.disabled = true; out.replaceChildren(); if (!area.value.trim()) return;
      try { const doc = aiRead(area.value); if (!doc || !doc.render) throw new Error("La réponse ne contient pas de bloc « render »."); const d = tidyRender(doc.render), diff = aiDiff(tidyRender(R()), d);
        out.append(el("p", null, diff.length ? `${diff.length} changement(s) :` : "Aucun changement dans le rendu."), el("ul", { class: "decisions" }, diff.slice(0, 30).map((x) => el("li", null, `${x.path} — ${x.text}`))), guideBox(renderGuide({ render: d }, [...new Set(asm().instances.map((i) => i.part))]).filter((x) => x.level !== "tip"), { title: "Ce que le rendu revenu demande" }) || el("span"));
        if (diff.length) { next = d; ok.disabled = false; }
      } catch (e) { out.append(el("p", { class: "form-error" }, e.message)); } });
    const m = modal("Réimporter le rendu depuis une IA", [field("Réponse de l'assistant", area), out, el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), ok)], { wide: true });
  }
  function renderLeft() {
    clear(left); const r = R(), take = btn("Faire l'image (.png)", shoot, { primary: true, icon: "download", tip: "L'image au format choisi, avec la marque de la plateforme dans le coin" }); take.dataset.shoot = "";
    left.append(el("div", { class: "side-head" }, el("h2", null, "Rendu"), el("a", { class: "btn btn-small", href: `#/labels/${encodeURIComponent(id)}`, "data-tip": "Étiquettes et autocollants de cet assemblage" }, icon("edit"))));
    const scroll = el("div", { class: "side-scroll" }); left.append(scroll);
    if (list.length > 1) scroll.append(el("div", { class: "side-section" }, list.map((a) => el("a", { class: "nav-item" + (a.id === id ? " active" : ""), href: `#/render/${encodeURIComponent(a.id)}` }, icon("assembly"), el("span", { class: "grow" }, a.name || a.id)))));
    scroll.append(el("div", { class: "side-section", "data-box": "scene" }, el("h3", null, "Le décor"), el("div", { class: "cf-tiles" }, Object.entries(SCENES).map(([k, S]) => tile({ sel: k === r.scene, color: k === "dark" ? "#3a4350" : k === "sky" ? "#3b82c4" : "#8a8f98", label: S.fr, tip: S.text, pic: scenePic(S), data: { "data-scene": k }, run: () => change(`Décor : ${S.fr.toLowerCase()}`, (x) => { x.scene = k; }) })))));
    scroll.append(el("div", { class: "side-section", "data-box": "shot" }, el("h3", null, "Le point de vue"), el("div", { class: "cf-tiles" }, Object.entries(SHOTS).map(([k, S]) => tile({ sel: !st.free && !r.view && k === r.shot, color: "#0c66e4", label: S.fr, tip: S.text, pic: shotPic(k), data: { "data-shot": k }, run: () => { st.free = null; change(`Point de vue : ${S.fr.toLowerCase()}`, (x) => { x.shot = k; x.view = null; }); } }))),
      st.free ? el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, btn("Garder ce point de vue", () => { const v = st.free; change("Point de vue gardé", (x) => { x.view = v; }); }, { small: true, icon: "check", tip: "Le point de vue réglé à la souris est gardé avec l'assemblage" })) : r.view ? el("p", { class: "muted small" }, "Point de vue réglé à la souris, gardé avec l'assemblage. Une tuile le remplace.") : null));
    scroll.append(el("div", { class: "side-section", "data-box": "size" }, el("h3", null, "L'image"),
      el("div", { class: "form-row tight" }, field("Format", el("select", { "data-size": "", onChange: (e) => change("Format de l'image", (x) => { x.size = e.target.value; }) }, Object.entries(SIZES).map(([k, S]) => el("option", { value: k, selected: k === r.size }, `${S.fr} — ${S.w} × ${S.h}`))))),
      el("label", { class: "check small" }, el("input", { type: "checkbox", checked: r.ground, onChange: (e) => change("Ombre au sol", (x) => { x.ground = e.target.checked; }) }), "Ombre portée sur le sol"),
      el("label", { class: "check small" }, el("input", { type: "checkbox", checked: r.labels, onChange: (e) => change("Étiquettes dans l'image", (x) => { x.labels = e.target.checked; }) }), "Montrer les étiquettes et autocollants"),
      el("div", { class: "form-actions", style: { justifyContent: "flex-start", marginTop: ".5rem" } }, take)));
    const g = guideBox(guide(), { title: "Ce que le rendu demande", quiet: "Décor, point de vue et finitions : prêts." }); if (g) scroll.append(el("div", { class: "side-section" }, g));
    scroll.append(el("div", { class: "side-section" }, el("h3", null, "Avec une IA"), el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } },
      btn("Copier pour une IA", async () => toast((await copyText(request(asm(), st.ctx ? lookRows(open(), st.ctx.built, names()) : []))) ? "Copié : le rendu et sa consigne." : "Copie impossible.", "success", 5000), { small: true, icon: "sparkle", tip: "Le rendu, précédé de la façon de mener l'entrevue et de la réponse attendue" }),
      btn("Réimporter…", reimport, { small: true, icon: "wizard", tip: "Aperçu des changements, puis une seule étape annulable" }))));
  }
  function card(row) {
    const r = R(), cur = r.looks[row.part] || {}, F = FINISHES[row.finish], pick = (k) => change(`${row.part} : ${FINISHES[k].label.toLowerCase()}`, (x) => { x.looks[row.part] = { finish: k, ...(FINISHES[k].tint ? { color: (x.looks[row.part] || {}).color || row.color } : {}) }; });
    return el("div", { class: "card taped ft-card", "data-part-card": row.part },
      ...FINISH_GROUPS.map((G) => [el("p", { class: "ft-label rd-group", style: `--dom:${G.color}` }, G.label), el("div", { class: "cf-tiles rd-finishes" }, Object.entries(FINISHES).filter(([, f]) => f.group === G.id).map(([k, f]) => tile({ sel: row.chosen && k === row.finish, color: G.color, label: f.label, tip: f.text, pic: finishPic(k, row.color), data: { "data-finish": k }, run: () => pick(k) })))]).flat(),
      el("div", { class: "form-row tight" }, F.tint ? field("Sa couleur", el("input", { type: "color", value: row.color, "data-look-color": "", onChange: (e) => change(`${row.part} : couleur`, (x) => { x.looks[row.part] = { finish: row.finish, color: e.target.value }; }) })) : el("p", { class: "muted small", style: { margin: 0 } }, "Cette finition montre la couleur de la matière.")),
      el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, cur.finish ? btn("Revenir à la matière", () => change(`${row.part} : finition de la matière`, (x) => { delete x.looks[row.part]; }), { small: true, icon: "refresh", tip: "Retire le choix : la pièce montre la finition de sa matière" }) : el("small", { class: "muted" }, "Finition de la matière — choisissez-en une ci-dessus.")));
  }
  function renderRight() {
    clear(right); right.append(el("div", { class: "side-head" }, el("h2", null, "Finitions"), el("a", { class: "btn btn-small", href: `#/assembly/${encodeURIComponent(id)}`, "data-tip": "Ouvrir l'assemblage" }, icon("assembly"))));
    const body = el("div", { class: "side-scroll", "data-looks": "" }); right.append(body);
    if (!st.ctx) { body.append(el("p", { class: "atelier-hint" }, icon("info"), " Construction de l'assemblage…")); return; }
    const rows = lookRows(open(), st.ctx.built, names());
    for (const G of FINISH_GROUPS) { const mine = rows.filter((x) => x.group === G.id); if (!mine.length) continue;
      body.append(el("div", { class: "ft-group", style: `--dom:${G.color}`, "data-finish-group": G.id }, el("div", { class: "lib-group-head" }, el("b", null, G.label), el("small", null, ""), el("span", { class: "lib-count" }, String(mine.length))),
        mine.map((row) => { const on = row.part === st.sel; return [el("button", { class: `ft-row${on ? " sel" : ""}`, type: "button", "data-part": row.part, "aria-expanded": on ? "true" : "false", style: `--dom:${G.color}`, onClick: () => { st.sel = on ? null : row.part; renderRight(); glow(); } }, finishPic(row.finish, row.color),
          el("span", { class: "ft-name" }, el("b", null, row.name), el("small", null, `${row.label}${row.qty > 1 ? ` · × ${row.qty}` : ""} · ${row.part}`)), row.chosen ? badge("choisie", "info") : null), on ? card(row) : null]; }))); }
    body.append(el("p", { class: "muted small" }, "Une finition habille toutes les instances d'une pièce. Les finitions sont des réglages d'image, pas des finitions d'atelier. ", el("a", { href: "#/help/sources/project" }, "Sources")));
  }
  const refresh = () => { renderLeft(); renderRight(); setGuide(guide()); };
  const off = store.on("change", () => { if (!store.assembly(id)) { go("#/render"); return; } refresh(); dress(true); });
  refresh(); build();
  return () => { st.alive = false; off(); st.token++; setGuide([]); stage.dispose(); };
}

registerModule({ key: "render", label: "Rendu", icon: "sparkle", tip: "Rendu marketing : la finition de chaque pièce, un décor, un point de vue, et l'image du produit", render });
