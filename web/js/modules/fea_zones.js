/* DynamiteOrbit — Simulation : refinement zones, in the side panel, under the right click and in the view.
   A zone is a cylinder or a square prism along X, Y or Z, placed in the model. Where it meets the product the cubes are 2, 3 or 4
   times smaller — its shape shows on the part, in small cubes — and the model is solved with its zones as one mesh.
   The mesh and the physics are in analysis/fea/refine.js and composite.js ; this is only their screen. */

import { el, btn, icon, svg, onOff } from "../core/dom.js";
import { needField } from "../core/guide.js";
import { show } from "../analysis/fea/summary.js";
import { ZONE_SHAPES, ZONE_RATIOS, normZone, zoneOutline, zoneText } from "../analysis/fea/refine.js";
import { zoneWalls, fitToWall } from "../analysis/fea/entity.js";

export const ZONE_COLOR = "#8b5cf6", ZONE_TINT = [0.79, 0.73, 0.97];      // the colour of the zones : their outline, their label, their fine cubes on the grey model
const AX = "XYZ", r2 = (x) => Math.round(x * 100) / 100, fr = (x, d = 2) => String(Math.round(x * 10 ** d) / 10 ** d).replace(".", ",");

/** The pictogram of a shape : a cylinder, a square prism. */
function shapeMark(shape) {
  const a = { fill: "none", stroke: "currentColor", "stroke-width": 1.7, "stroke-linejoin": "round", "stroke-linecap": "round" };
  return svg("svg", { viewBox: "0 0 24 24", width: 20, height: 20, "aria-hidden": "true" }, shape === "prism"
    ? [svg("path", { ...a, d: "M4 8l8-4 8 4-8 4z" }), svg("path", { ...a, d: "M4 8v8.5l8 4 8-4V8M12 12v8.5" })]
    : [svg("ellipse", { ...a, cx: 12, cy: 6.5, rx: 7, ry: 3 }), svg("path", { ...a, d: "M5 6.5v11c0 1.7 3.1 3 7 3s7-1.3 7-3v-11" })]);
}
/** A new zone at a point : a few cubes of the model wide — an example, the designer enters his own — and as long as the ONE wall
    under the point is thick : a zone put on the lid of a box does not run through the box. Where no wall is met, its length is an
    example too. */
export function newZone(zones, shape, axis, at, model) {
  const n = 1 + Math.max(0, ...zones.map((z) => parseInt(String(z.id || "").slice(1), 10) || 0)), size = Math.max(1, Math.round(4 * model.grid.h));
  const z = { id: `Z${n}`, shape, axis, size, length: size, at: at.map(r2), ratio: 2, ask: ["size", "length"] }, fit = fitToWall(model, z);
  return fit ? { ...z, at: fit.at.map(r2), length: r2(fit.length), ask: ["size"] } : z;
}

/** The section of the side panel. o : { st (st.zones), preps (the zones as the mesh took them : [{ id, prep } | { id, error }]), h (cube of
    the model), model (the mesh : the walls a zone crosses are read on it), apply() (a zone changed : mesh it again), aim(set) (the next click
    on the part gives set(point, normal)), hover(zone | null), shown (the volumes are drawn in the view), result (the view is the result), show(on) } */
export function zonesSection(o) {
  const { st } = o, sec = el("div", { class: "side-section" }), along = (n) => { const a = (n || [0, 0, 1]).map(Math.abs); return a.indexOf(Math.max(...a)); };
  const eye = st.zones.length && o.show ? el("button", { class: "icon-btn eye" + (o.shown ? " on" : ""), type: "button", "aria-pressed": o.shown ? "true" : "false", "aria-label": "Volumes de raffinement dans la vue",
    "data-tip": o.shown ? `Volumes affichés${o.result ? " sur le résultat" : ""} — cliquer pour les cacher (le maillage fin reste)` : `Volumes cachés${o.result ? " sur le résultat" : ""} — cliquer pour les montrer. Le survol d'une zone la montre.`, onClick: () => o.show(!o.shown) }, icon(o.shown ? "eye" : "eye-off")) : null;
  const rows = [el("h3", null, el("span", { class: "grow" }, "Zones de raffinement"), eye, btn("", () => o.aim((p, n) => { st.zones.push(newZone(st.zones, "cylinder", along(n), p, o.model)); o.apply(); }),
    { small: true, icon: "plus", tip: "Ajouter une zone — puis cliquez sur la pièce le point où la centrer. Une zone : un volume où les cubes du maillage sont plus petits" }))];
  st.zones.forEach((z, i) => {
    const got = o.preps.find((p) => p.id === z.id), ok = got && got.prep, set = (patch) => { Object.assign(z, patch); o.apply(); };
    /* the walls of the part the zone crosses : one is the usual wish — a zone on a hole of the lid, not through the whole box */
    const nz = normZone(z), walls = nz ? zoneWalls(o.model, nz) : [], thick = walls.map((w) => fr(w.hi - w.lo)).join(" et "), one = nz && walls.length !== 1 ? fitToWall(o.model, nz) : null;
    /* a cote the tool invented blinks until the designer types his own or keeps it */
    const num = (f, label, unit) => { const ask = Array.isArray(z.ask) && z.ask.includes(f), done = () => { if (Array.isArray(z.ask)) { z.ask = z.ask.filter((k) => k !== f); if (!z.ask.length) delete z.ask; } };
      const input = el("input", { type: "number", min: 0, value: z[f], step: "any", "aria-label": `${label} (${unit})`, "data-field": f, style: { flex: "1 1 3rem", width: "3rem", minWidth: 0 }, onChange: (e) => { const v = parseFloat(e.target.value); if (v > 0) { z[f] = v; done(); o.apply(); } }, onKeydown: (e) => { if (e.key === "Enter" && ask) { done(); o.apply(); } } });
      return el("div", { class: "bc-row", style: { flexWrap: "nowrap" } }, el("small", { style: { flex: "0 0 5.4rem" } }, label), ask ? needField(input, { hint: "Cote d'exemple : tapez la vôtre, ou confirmez-la (Entrée, ou la coche)" }) : input, el("small", null, unit),
        ...(ask ? [el("button", { class: "icon-btn ask-ok", type: "button", "aria-label": `Garder ${fr(z[f])} ${unit}`, "data-tip": "Garder cette cote", onClick: () => { done(); o.apply(); } }, icon("check"))] : [])); };
    const coord = (d) => el("input", { type: "number", value: r2(z.at[d]), step: "any", "aria-label": `Centre de la zone, ${AX[d]} (mm)`, "data-field": d ? null : "at", style: { flex: "1 1 0", width: 0, minWidth: 0 }, onChange: (e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) { const at = z.at.slice(); at[d] = v; set({ at }); } } });
    const copy = () => { const n = 1 + Math.max(0, ...st.zones.map((x) => parseInt(String(x.id || "").slice(1), 10) || 0)); st.zones.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(z)), id: `Z${n}`, off: true }); o.apply(); };
    const card = el("div", { class: "card" + (z.off ? " zone-off" : ""), style: { padding: ".35rem .45rem", margin: ".3rem 0", borderLeft: `4px solid ${ZONE_COLOR}` }, "data-zone": z.id, onMouseenter: () => o.hover(z), onMouseleave: () => o.hover(null) },
      el("div", { style: { display: "flex", gap: ".3rem", alignItems: "center" } }, el("b", null, z.id),
        onOff(!z.off, (on) => { if (on) delete z.off; else z.off = true; o.apply(); }, z.id, z.off ? `${z.id} est de côté (Off) : ni maillée ni résolue — cliquer pour la remettre (On)` : `${z.id} compte (On) — cliquer pour la mettre de côté (Off) sans la perdre`),
        el("div", { class: "seg", role: "group", "aria-label": "Forme de la zone" }, Object.entries(ZONE_SHAPES).map(([k, s]) => el("button", { class: "seg-btn" + (k === z.shape ? " on" : ""), type: "button", "aria-pressed": k === z.shape ? "true" : "false", "aria-label": s.fr, "data-tip": `${s.fr} — ${k === "prism" ? "section carrée, un côté et une longueur" : "un diamètre et une longueur"}`, onClick: () => set({ shape: k }) }, shapeMark(k)))),
        el("select", { "aria-label": "Axe de la zone", "data-tip": "L'axe le long duquel court la longueur", style: { flex: "1 1 auto", minWidth: 0 }, onChange: (e) => set({ axis: +e.target.value }) }, [0, 1, 2].map((a) => el("option", { value: a, selected: a === z.axis }, `axe ${AX[a]}`))),
        el("button", { class: "icon-btn", type: "button", "aria-label": `Dupliquer la zone ${z.id}`, "data-tip": `Dupliquer ${z.id} : la copie naît à Off — changez-y une cote, mettez-la à On à la place de ${z.id}, relancez, comparez`, style: { fontSize: ".95rem" }, onClick: copy }, icon("copy")),
        el("button", { class: "icon-btn", type: "button", "aria-label": `Retirer la zone ${z.id}`, "data-tip": "Retirer", onClick: () => { st.zones.splice(i, 1); o.apply(); } }, "×")),
      el("div", { style: { height: ".3rem" } }),
      num("size", ZONE_SHAPES[z.shape] ? `${ZONE_SHAPES[z.shape].mark} ${ZONE_SHAPES[z.shape].size.toLowerCase()}` : "cote", "mm"), num("length", "longueur", "mm"),
      el("div", { class: "bc-row" }, el("small", { class: "grow" }, "centre — X, Y, Z (mm)"), btn("Viser", () => o.aim((p) => set({ at: p.map(r2) })), { small: true, icon: "fit", tip: "Placer le centre : cliquez un point de la pièce" })),
      el("div", { class: "bc-row", style: { flexWrap: "nowrap" } }, coord(0), coord(1), coord(2)),
      el("div", { class: "bc-row" }, el("select", { "aria-label": "Finesse de la zone", style: { flex: "1 1 auto", minWidth: 0 }, onChange: (e) => set({ ratio: +e.target.value }) }, ZONE_RATIOS.map((r) => el("option", { value: r, selected: r === (z.ratio || 2) }, `cubes ${r} fois plus petits — ${fr(o.h / r)} mm`)))),
      ...(ok && walls.length ? [el("div", { class: "bc-row" }, el("small", { class: "grow" }, walls.length === 1 ? `Traverse une paroi de ${thick} mm.` : `Traverse ${walls.length} parois (${thick} mm).`),
        ...(walls.length > 1 && one ? [btn("Une seule paroi", () => set({ at: one.at.map(r2), length: r2(one.length), ask: (z.ask || []).filter((k) => k !== "length") }), { small: true, icon: "fit", tip: `Raccourcir la zone à la paroi la plus proche de son centre (${fr(one.wall.hi - one.wall.lo)} mm), et l'y centrer` })] : []))] : []),
      el("p", { class: ok || z.off ? "muted small" : "form-error small", style: { margin: ".2rem 0 0" } }, z.off ? "Off — de côté : ni maillée ni résolue. Ses cotes restent, pour la remettre." : ok ? `${got.prep.local.nCells.toLocaleString("fr-CA")} cubes fins à la place de ${got.prep.block.kept.toLocaleString("fr-CA")} cube${got.prep.block.kept > 1 ? "s" : ""} du modèle${got.prep.dropped ? ` — ${got.prep.dropped} cube(s) fin(s) sans lien avec le reste, laissés de côté` : ""}.` : (got && got.error) || "Zone incomplète."));
    rows.push(card);
  });
  rows.push(el("p", { class: "muted small" }, st.zones.length ? "La zone se voit sur le modèle : son contour, et en petits cubes ce qu'elle partage avec la pièce. Elle est résolue avec le reste, comme un seul maillage ; un détail plus petit qu'un cube du modèle (petit trou, congé) y réapparaît."
    : "Un cylindre ou un prisme placé dans le modèle : là où il coupe la pièce, les cubes sont 2 à 4 fois plus petits. Pour regarder de près un trou, un congé, le bord d'un appui — sans affiner tout le maillage. Le « + », ou un clic droit sur la pièce : « Raffiner le maillage ici »."));
  const nOff = st.zones.filter((z) => z.off).length; sec.append(...rows); sec.setAttribute("data-fold-note", st.zones.length ? `${st.zones.length} zone${st.zones.length > 1 ? "s" : ""}${nOff ? ` · ${nOff} à Off` : ""}` : "aucune");
  return sec;
}

/** What a right click offers for zones : a zone at the point shown, its axis along the normal of the face, as long as the wall there is thick. */
export function zoneMenu(hit, st, model, apply) {
  if (!hit || !hit.point) return [];
  const n = (hit.normal || [0, 0, 1]).map(Math.abs), axis = n.indexOf(Math.max(...n)), make = (shape) => () => { st.zones.push(newZone(st.zones, shape, axis, hit.point, model)); apply(st.zones[st.zones.length - 1]); };
  return [{ title: "Raffiner le maillage ici" }, { label: `Zone cylindrique, axe ${AX[axis]}`, icon: "plus", run: make("cylinder") }, { label: `Zone prismatique (section carrée), axe ${AX[axis]}`, icon: "plus", run: make("prism") }];
}

/** Draws the zones in the view : outline and name. lit : the zone the pointer is on, drawn stronger. */
export function drawZones(viewer, zones, lit, onClick) {
  viewer.clearOverlays("zone");
  for (const raw of zones) {
    const z = normZone(raw); if (!z) continue;
    const o = zoneOutline(z), strong = lit && lit.id === raw.id;
    for (const l of o.loops) viewer.addPath(l, ZONE_COLOR, "zone", strong ? 0.7 : 0.4);
    for (const l of o.lines) viewer.addPath(l, ZONE_COLOR, "zone", strong ? 0.5 : 0.28, true);
    const b = viewer.addLabel(o.lines[0][1], raw.id, "zone", "bc", onClick ? () => onClick(raw) : null);
    if (b) { b.style.borderColor = ZONE_COLOR; b.style.setProperty("--bc", ZONE_COLOR); b.dataset.tip = zoneText(z); b.setAttribute("aria-label", `Zone de raffinement ${raw.id} : ${zoneText(z)}`); }
  }
}

/** What the result panel says of the zones of a run. zones : the rows of the worker ; thermal : temperatures, not stresses. → element or null */
export function zonesResult(zones, thermal) {
  if (!zones || !zones.length) return null;
  const unit = thermal ? "°C" : "MPa", done = zones.filter((z) => !z.error), failed = zones.filter((z) => z.error);
  const sec = el("div", { class: "side-section" }, el("h3", null, "Zones de raffinement"));
  if (done.length) {
    const t = el("table", { class: "table small" }, el("thead", null, el("tr", null, ["", "Maillage", thermal ? "T max dans la zone" : "Pointe dans la zone", "Modèle seul", "Écart"].map((x) => el("th", null, x)))), el("tbody", null, done.map((z) => {
      const a = z.alone ? z.alone.value : null, gap = a !== null && Math.abs(a) > 1e-9 ? (z.peak.value - a) / Math.abs(a) : null;
      return el("tr", null, el("td", null, el("b", null, z.id)), el("td", null, `${z.cells.toLocaleString("fr-CA")} cubes de ${fr(z.h)} mm`), el("td", null, `${show(z.peak.value, 1)} ${unit}`), el("td", null, a === null ? "—" : `${show(a, 1)} ${unit}`), el("td", null, gap === null ? "—" : `${gap > 0 ? "+" : ""}${Math.round(gap * 100)} %`)); })));
    sec.append(t, el("p", { class: "muted small" }, thermal ? "« Modèle seul » : ce que les cubes du modèle disaient au même endroit, avant la zone." : "« Modèle seul » : la pointe que les cubes du modèle donnaient au même endroit, avant la zone. La zone et le reste sont résolus ensemble, comme un seul maillage ; affinez encore la zone pour voir si sa pointe se stabilise — au fond d'une entaille vive, elle ne se stabilise pas."));
  }
  for (const z of failed) sec.append(el("p", { class: "atelier-hint warn" }, icon("warning"), ` ${z.id} n'a pas été résolue : ${z.error} Le résultat affiché à cet endroit est celui du modèle seul.`));
  return sec;
}
