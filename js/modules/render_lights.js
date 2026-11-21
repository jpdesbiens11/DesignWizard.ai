/* DesignWizard.ai — Studio photo, the lighting : the setups one chooses (three-point, high key, the sun at different hours…),
   grouped by nature, each with a small diagram of itself ; the PLOT — the studio seen from above, the camera at the bottom as on
   a lighting diagram, each lamp a dot one drags around the product (toward the centre : higher) ; the list of the lamps, each
   with its On / Off, its copy, and its settings when it is in hand : where it stands, how strong, how soft, how warm, and
   whether it casts a shadow. The numbers : core/photo_lights.js. The screen (modules/render.js) says what each gesture writes. */

import { el, svg, icon, btn, field, onOff } from "../core/dom.js";
import { LIGHT_GROUPS, LIGHT_KINDS, LIGHT_SETUPS, MAX_LIGHTS, MAX_SHADOWS, plotXY, plotToLight, lightWords, kelvinHex, softAngle, shadowLights, liveLights } from "../core/photo_lights.js";

const R = 88, groupOf = (kind) => LIGHT_GROUPS.find((g) => g.id === LIGHT_KINDS[kind].group) || LIGHT_GROUPS[0];
const pic = (...kids) => svg("svg", { viewBox: "0 0 30 30", width: 30, height: 30, "aria-hidden": "true" }, ...kids.flat(Infinity));
const rays = (x, y, a, n, r0, r1, more = {}) => Array.from({ length: n }, (_, i) => { const t = ((a[0] + ((a[1] - a[0]) * (n > 1 ? i / (n - 1) : 0.5))) * Math.PI) / 180; return svg("path", { d: `M${x + r0 * Math.cos(t)} ${y + r0 * Math.sin(t)} L${x + r1 * Math.cos(t)} ${y + r1 * Math.sin(t)}`, stroke: "var(--dom)", "stroke-width": 1.4, "stroke-linecap": "round", ...more }); });
const thing = () => svg("rect", { x: 11, y: 17, width: 9, height: 8, rx: 1.6, fill: "currentColor", "fill-opacity": 0.2, stroke: "currentColor", "stroke-width": 1.1 });
/** A light of a kind, as a small drawing : where it stands relative to the product, and how it shines. */
export const kindPic = (kind) => ({
  key: () => pic(thing(), svg("circle", { cx: 6.5, cy: 7.5, r: 3.6, fill: "var(--dom)" }), rays(6.5, 7.5, [20, 60], 3, 5.4, 9.5)),
  fill: () => pic(thing(), svg("rect", { x: 21, y: 6, width: 5, height: 13, rx: 1.4, fill: "var(--dom)", "fill-opacity": 0.55, stroke: "var(--dom)", "stroke-width": 1 }), rays(21, 14, [150, 195], 3, 1.5, 5, { "stroke-opacity": 0.5 })),
  rim: () => pic(svg("path", { d: "M9.5 16.5 Q15.5 9.5 21.5 16.5", fill: "none", stroke: "var(--dom)", "stroke-width": 2.4, "stroke-linecap": "round" }), thing(), svg("circle", { cx: 15.5, cy: 5.5, r: 2.6, fill: "var(--dom)" })),
  top: () => pic(thing(), svg("rect", { x: 8, y: 3.5, width: 15, height: 3.6, rx: 1.4, fill: "var(--dom)" }), rays(15.5, 7.4, [60, 120], 3, 1.6, 6.5)),
  sun: () => pic(svg("circle", { cx: 15, cy: 15, r: 5.2, fill: "var(--dom)" }), rays(15, 15, [0, 315], 8, 7.6, 11.4)),
})[kind]();
/* a setup as a small plot : the product, the camera at the bottom, a dot where each lamp stands */
const setupPic = (id) => { const S = LIGHT_SETUPS[id]; return svg("svg", { viewBox: "-24 -24 48 48", width: 46, height: 46, class: "cf-icon", "aria-hidden": "true" }, svg("circle", { r: 20, fill: "none", stroke: "currentColor", "stroke-opacity": 0.35, "stroke-width": 1 }), svg("rect", { x: -4, y: -3, width: 8, height: 6, rx: 1.5, fill: "currentColor", "fill-opacity": 0.25 }),
  svg("path", { d: "M-3 21 h6 l-3 -5 z", fill: "currentColor", "fill-opacity": 0.55 }), S.lights.map((l) => { const [x, y] = plotXY(l.az, l.el, 0, 20); return svg("circle", { cx: x, cy: y, r: 2.4 + 2.2 * Math.min(1, l.power / 2.6), fill: "var(--dom)", "fill-opacity": l.shadow ? 1 : 0.55 }); })); };
const tile = (o) => el("button", { class: `cf-tile${o.sel ? " sel" : ""}`, type: "button", "aria-pressed": o.sel ? "true" : "false", "data-tip": o.tip || null, style: `--dom:${o.color}`, onClick: o.run, ...o.data }, o.pic, el("b", null, o.label));

/** The plot. o : { lights, camAz, sel, move(id, { az, el }, done), select(id) }. → { node, place(id, az, el) : moves a dot without drawing the panel again } */
export function lightPlot(o) {
  const dots = new Map(), at = (l) => plotXY(l.az, l.el, o.camAz, R), box = svg("svg", { viewBox: "-104 -104 208 222", class: "lt-plot", role: "group", "aria-label": "Plan de l'éclairage, vu de dessus : l'appareil est en bas" });
  box.append(svg("circle", { r: R, class: "lt-ring" }), svg("circle", { r: (R * 2) / 3, class: "lt-ring in" }), svg("circle", { r: R / 3, class: "lt-ring in" }), svg("path", { d: `M${-R} 0 H${R} M0 ${-R} V${R}`, class: "lt-ring in" }),
    svg("rect", { x: -11, y: -8, width: 22, height: 16, rx: 4, class: "lt-thing" }), svg("path", { d: `M-9 ${R + 22} h18 v-9 h-5 l-2 -3 h-4 l-2 3 h-5 z`, class: "lt-cam" }), svg("circle", { cx: 0, cy: R + 17.5, r: 2.6, class: "lt-lens" }),
    svg("text", { x: -R - 12, y: -R - 6, class: "lt-note" }, "bord : à l'horizon"), svg("text", { x: 0, y: -R / 3 + 12, class: "lt-note", "text-anchor": "middle" }, "centre : au-dessus"));
  const beams = svg("g"), marks = svg("g"); box.append(beams, marks);
  o.lights.forEach((l, i) => {
    const G = groupOf(l.kind), [x, y] = at(l), on = !l.off && l.power > 0, sel = l.id === o.sel, K = LIGHT_KINDS[l.kind];
    const beam = svg("path", { d: `M${x} ${y} L0 0`, class: "lt-beam", stroke: G.color, "stroke-opacity": on ? 0.5 : 0.18 });
    const g = svg("g", { class: `lt-dot${sel ? " sel" : ""}${on ? "" : " off"}`, transform: `translate(${x} ${y})`, tabindex: "0", role: "button", "data-light": l.id, "aria-pressed": sel ? "true" : "false",
      "aria-label": `${K.label} ${i + 1} — ${lightWords(l, o.camAz)}. Glisser pour la placer ; flèches gauche et droite : tourner autour du produit, haut et bas : monter ou descendre.` },
      svg("circle", { r: 8.5 + 5 * l.soft, fill: on ? kelvinHex(l.kelvin) : "#aab0b8", stroke: sel ? "#ff7a1a" : G.color, "stroke-width": sel ? 3.4 : 2.2 }), svg("text", { y: 3.8, "text-anchor": "middle", class: "lt-num" }, String(i + 1)));
    let drag = null;
    const here = (e) => { const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(box.getScreenCTM().inverse()); return plotToLight(p.x, p.y, o.camAz, R); };
    g.addEventListener("pointerdown", (e) => { e.preventDefault(); g.setPointerCapture(e.pointerId); drag = { moved: false, at: null }; g.focus(); });
    g.addEventListener("pointermove", (e) => { if (!drag) return; const a = here(e); drag.moved = true; drag.at = a; api.place(l.id, a.az, a.el); o.move(l.id, a, false); });
    g.addEventListener("pointerup", () => { const d = drag; drag = null; if (d && d.moved && d.at) o.move(l.id, d.at, true); else o.select(l.id); });
    g.addEventListener("keydown", (e) => { const step = e.shiftKey ? 15 : 5, d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key]; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); o.select(l.id); return; } if (!d) return; e.preventDefault(); o.move(l.id, { az: l.az + d[0], el: Math.max(0, Math.min(90, l.el + d[1])) }, true); });
    beams.append(beam); marks.append(g); dots.set(l.id, { g, beam });
  });
  const api = { node: box, place(id, az, el) { const d = dots.get(id); if (!d) return; const [x, y] = plotXY(az, el, o.camAz, R); d.g.setAttribute("transform", `translate(${x} ${y})`); d.beam.setAttribute("d", `M${x} ${y} L0 0`); } };
  return api;
}

/** The panel. o : { lights, ambient, setup, own, camAz, sel, lamps, sunny (the set has a sky : the daylight setups make sense),
      pickSetup(id), backToSet(), setAmbient(v), move(id, { az, el }, done), patch(id, patch, label), toggle(id, on), copy(id), drop(id), add(kind), select(id), showLamps(on) }
    → { nodes, plot } */
export function lightsPanel(o) {
  const out = [], sec = (title, note, ...kids) => { const s = el("div", { class: "side-section", "data-fold-note": note }, el("h3", null, title), ...kids.flat().filter(Boolean)); out.push(s); return s; }, n = o.lights.length, casting = new Set(shadowLights(o.lights));
  /* the setups, by nature */
  sec("L'éclairage", o.own ? "placé à la main" : LIGHT_SETUPS[o.setup].label,
    el("p", { class: "muted small lt-say", "data-light-say": "" }, o.own ? "Lumières placées à la main : elles restent où vous les avez mises." : `${LIGHT_SETUPS[o.setup].label} — ${LIGHT_SETUPS[o.setup].text.toLowerCase()}. L'éclairage se pose par rapport à l'appareil du point de vue choisi.`),
    LIGHT_GROUPS.map((G) => [el("p", { class: "ft-label rd-group", style: `--dom:${G.color}` }, G.label), el("div", { class: "cf-tiles lt-setups" }, Object.entries(LIGHT_SETUPS).filter(([, S]) => S.group === G.id).map(([k, S]) => tile({ sel: !o.own && k === o.setup, color: G.color, label: S.label, tip: `${S.fr} — ${S.text}`, pic: setupPic(k), data: { "data-setup": k }, run: () => o.pickSetup(k) })))]),
    o.own ? el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, btn("Revenir à un éclairage tout fait", () => o.backToSet(), { small: true, icon: "refresh", tip: "Retire les lumières placées à la main : l'éclairage redevient celui du décor, posé par rapport à l'appareil" })) : null);
  /* the plot and the light from everywhere */
  const plot = lightPlot(o), amb = el("input", { type: "number", min: 0, max: 150, step: 5, value: Math.round(o.ambient * 100), "data-ambient": "", onChange: (e) => o.setAmbient(Math.max(0, Math.min(150, Number(e.target.value) || 0)) / 100) });
  sec("Le plan", `${liveLights(o.lights).length} allumée(s)`, plot.node,
    el("p", { class: "muted small" }, "Vu de dessus, l'appareil en bas. Glissez une lampe autour du produit ; vers le centre, elle monte. Les mêmes lampes se prennent dans la vue."),
    el("div", { class: "form-row tight" }, field("Lumière d'ambiance (%)", amb, "Ce qui reste dans une ombre : le ciel, les murs"),
      el("label", { class: "check small", style: { alignSelf: "end" } }, el("input", { type: "checkbox", checked: o.lamps, "data-lamps": "", onChange: (e) => o.showLamps(e.target.checked) }), "Lampes dans la vue")));
  /* the lamps, one by one */
  const rows = o.lights.map((l, i) => {
    const K = LIGHT_KINDS[l.kind], G = groupOf(l.kind), sel = l.id === o.sel, on = !l.off, num = (key, label, a, hint, more = {}) => field(label, el("input", { type: "number", value: a.value, min: a.min, max: a.max, step: a.step, [`data-light-${key}`]: "", onChange: (e) => { const v = Number(e.target.value); if (Number.isFinite(v)) o.patch(l.id, a.write(v), `${K.label} ${i + 1} : ${label.toLowerCase()}`); }, ...more }), hint);
    const row = el("div", { class: `lt-row${sel ? " sel" : ""}${on ? "" : " off"}`, style: `--dom:${G.color}`, "data-light-row": l.id },
      onOff(on, (next) => o.toggle(l.id, next), `${K.label} ${i + 1}`),
      el("button", { class: "lt-name", type: "button", "aria-expanded": sel ? "true" : "false", onClick: () => o.select(sel ? null : l.id) }, kindPic(l.kind), el("span", null, el("b", null, `${i + 1} · ${K.label}`), el("small", null, `${lightWords(l, o.camAz)}${l.shadow ? (casting.has(l.id) || !on ? " · ombre" : " · ombre non portée") : ""}`))),
      btn("", () => o.copy(l.id), { small: true, icon: "copy", tip: n >= MAX_LIGHTS ? `Au plus ${MAX_LIGHTS} lumières` : "Copier cette lumière : la copie naît à Off, un peu plus loin", disabled: n >= MAX_LIGHTS }),
      btn("", () => o.drop(l.id), { small: true, icon: "trash", tip: "Retirer cette lumière" }));
    if (!sel) return row;
    return [row, el("div", { class: "card taped lt-card", "data-light-card": l.id, style: `--dom:${G.color}` },
      el("div", { class: "form-row tight" }, num("az", "Autour (°)", { value: l.az, min: -180, max: 180, step: 5, write: (v) => ({ az: v }) }, "0° : +X · 90° : +Y"), num("el", "Hauteur (°)", { value: l.el, min: 0, max: 90, step: 5, write: (v) => ({ el: v }) }, "0° : rasante · 90° : au-dessus")),
      el("div", { class: "form-row tight" }, num("power", "Puissance", { value: l.power, min: 0, max: 6, step: 0.1, write: (v) => ({ power: v }) }, "1 : une lampe ordinaire"), num("soft", "Douceur (%)", { value: Math.round(l.soft * 100), min: 0, max: 100, step: 5, write: (v) => ({ soft: v / 100 }) }, `Source vue sous ${(2 * softAngle(l.soft)).toFixed(1).replace(".", ",")}°`)),
      el("div", { class: "form-row tight" }, num("kelvin", "Température (K)", { value: l.kelvin, min: 2000, max: 10000, step: 100, write: (v) => ({ kelvin: v }) }, "Chaude en bas, froide en haut"),
        el("div", { class: "lt-kelvins" }, [[3200, "Tungsten"], [5600, "Daylight"], [6500, "Overcast"]].map(([k, name]) => el("button", { class: `lt-k${l.kelvin === k ? " on" : ""}`, type: "button", "data-tip": `${name} — ${k} K`, style: `--k:${kelvinHex(k)}`, onClick: () => o.patch(l.id, { kelvin: k }, `${K.label} ${i + 1} : ${name.toLowerCase()}`) }, el("i"), name)))),
      el("label", { class: "check small" }, el("input", { type: "checkbox", checked: l.shadow, "data-light-shadow": "", onChange: (e) => o.patch(l.id, { shadow: e.target.checked }, `${K.label} ${i + 1} : ombre`) }), "Porte une ombre"),
      l.shadow && on && !casting.has(l.id) ? el("p", { class: "muted small" }, `Seules les ${MAX_SHADOWS} lumières les plus fortes portent une ombre dans l'image.`) : null)];
  });
  sec(`Les lumières (${n})`, `${liveLights(o.lights).length} allumée(s)`, n ? rows : el("p", { class: "atelier-hint" }, icon("info"), " Aucune lumière : seule l'ambiance éclaire le produit."),
    LIGHT_GROUPS.map((G) => [el("p", { class: "ft-label rd-group", style: `--dom:${G.color}` }, `Ajouter — ${G.label}`), el("div", { class: "lt-add" }, Object.entries(LIGHT_KINDS).filter(([, K]) => K.group === G.id).map(([k, K]) => el("button", { class: "lt-kind", type: "button", disabled: n >= MAX_LIGHTS, style: `--dom:${G.color}`, "data-add-light": k, "data-tip": `${K.fr} — ${K.text}`, onClick: () => o.add(k) }, kindPic(k), el("b", null, K.label))))]));
  return { nodes: out, plot };
}
