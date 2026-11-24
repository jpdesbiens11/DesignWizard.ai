/* DynamiteOrbit.ai — Simulation : the instruments (demande de JP), in the side panel, under the right click, in the view and in
   the result panel. A temperature sensor or a strain gauge is put on the product the way a support is — a right click on a face,
   or « + » then a click — on the model or on the result. It is read on the result that is kept : moving it, or turning a gauge,
   changes its reading at once, and nothing is solved again. What a sensor is and how it is read : analysis/fea/sensors.js and
   probe.js ; this is only their screen.
   The usage it follows : a tag per instrument (TC1, SG2) as on a test plan ; a gauge drawn as a short line along its axis, a
   rosette as its three grids ; On / Off and a copy born Off, as every entry of the case. */

import { el, btn, icon, svg, onOff, table } from "../core/dom.js";
import { needField } from "../core/guide.js";
import { SENSOR_KINDS, ROSETTE, newSensor, copySensor, asksAngle, tangent, gaugeAxes, sensorText, rosetteLines, sensorNote } from "../analysis/fea/sensors.js";

const AX = "XYZ", r2 = (x) => Math.round(x * 100) / 100, fr = (x, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString("fr-CA", { maximumFractionDigits: d });
const A = { fill: "none", stroke: "currentColor", "stroke-width": 1.7, "stroke-linejoin": "round", "stroke-linecap": "round" };

/** The pictogram of an instrument : a thermometer, the grid of a gauge, the three grids of a rosette. */
export function sensorMark(kind, rosette) {
  const d = kind === "temp" ? ["M10 4.5a2 2 0 0 1 4 0v8.6a4.2 4.2 0 1 1-4 0z", "M12 9v6.5"] : rosette ? ["M4 19h8", "M5.5 17.5l6-6", "M4 19v-8", "M14.5 5.5l5 5M17 4v0M20 8v0"] : ["M5 6v12M9 6v12M13 6v12M17 6v12", "M5 6h4M9 18h4M13 6h4", "M17 18h3M5 18H3"];
  const s = svg("svg", { viewBox: "0 0 24 24", width: 20, height: 20, "aria-hidden": "true" }, d.map((p) => svg("path", { ...A, d: p })));
  if (kind === "temp") s.append(svg("circle", { cx: 12, cy: 16.8, r: 1.6, fill: "currentColor" }));
  return s;
}
const kindTip = (s) => { const K = SENSOR_KINDS[s.kind]; return s.kind === "gauge" && s.rosette ? `${ROSETTE.label} — ${ROSETTE.fr} : trois grilles, les deux déformations principales et leur direction` : `${K.label} — ${K.fr}`; };

/** The section of the side panel. o : { st (st.sensors), kinds (what the physics of the case reads : ["temp"], ["gauge"]…), rows (their
    readings, one per instrument), has (a result is kept), stale (it is the result of before), shown (their labels are in the view),
    show(on), apply(sensor) (an instrument changed), aim(set(point, normal, body)) (the next click on the part gives a point), hover(sensor | null) } */
export function sensorsSection(o) {
  const { st } = o, list = st.sensors, sec = el("div", { class: "side-section" });
  const eye = list.length ? el("button", { class: "icon-btn eye" + (o.shown ? " on" : ""), type: "button", "aria-pressed": o.shown ? "true" : "false", "aria-label": "Instruments dans la vue",
    "data-tip": o.shown ? "Instruments affichés dans la vue — cliquer pour les cacher" : "Instruments cachés — cliquer pour les montrer. Le survol d'une carte montre le sien.", onClick: () => o.show(!o.shown) }, icon(o.shown ? "eye" : "eye-off")) : null;
  const add = (kind) => btn(SENSOR_KINDS[kind].tag, () => o.aim((p, n, body) => { const s = newSensor(list, kind, p, { normal: n, body }); list.push(s); o.apply(s); }),
    { small: true, icon: "plus", aria: `Ajouter un instrument : ${SENSOR_KINDS[kind].label} (${SENSOR_KINDS[kind].tag})`, tip: `Ajouter : ${SENSOR_KINDS[kind].label} (${SENSOR_KINDS[kind].fr}) — puis cliquez sur la pièce l'endroit où le poser` });
  const rows = [el("h3", null, el("span", { class: "grow" }, "Instrumentation"), eye, ...o.kinds.map(add))];
  list.forEach((s, i) => {
    const K = SENSOR_KINDS[s.kind]; if (!K) return;
    const row = o.rows[i] || { state: "none", kind: s.kind }, reads = o.kinds.includes(s.kind), set = (patch) => { Object.assign(s, patch); o.apply(); };
    const done = () => { if (Array.isArray(s.ask)) { s.ask = s.ask.filter((k) => k !== "angle"); if (!s.ask.length) delete s.ask; } }, turn = (deg) => { s.angle = deg; done(); o.apply(); };
    const coord = (d) => el("input", { type: "number", value: r2(s.at[d]), step: "any", "aria-label": `${s.id}, ${AX[d]} (mm)`, "data-field": d ? null : "at", style: { flex: "1 1 0", width: 0, minWidth: 0 }, onChange: (e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) { const at = s.at.slice(); at[d] = v; set({ at }); } } });
    const card = el("div", { class: "card" + (s.off ? " zone-off" : ""), style: { padding: ".35rem .45rem", margin: ".3rem 0", borderLeft: `4px solid ${K.color}` }, "data-sensor": s.id, onMouseenter: () => o.hover(s), onMouseleave: () => o.hover(null) },
      el("div", { style: { display: "flex", gap: ".3rem", alignItems: "center" } }, el("b", null, s.id), el("span", { style: { color: K.color, display: "inline-flex" }, "data-tip": kindTip(s) }, sensorMark(s.kind, s.rosette)),
        el("input", { type: "text", value: s.name || "", placeholder: "nom", "data-tip": "Un nom, pour s'y retrouver dans les lectures : où il est collé", "aria-label": `Nom de ${s.id}`, style: { flex: "1 1 auto", minWidth: 0, padding: ".2rem .35rem", fontSize: ".84rem" }, onChange: (e) => { const v = e.target.value.replace(/\s+/g, " ").trim(); if (v) s.name = v; else delete s.name; o.apply(); } }),
        onOff(!s.off, (on) => { if (on) delete s.off; else s.off = true; o.apply(); }, s.id, s.off ? `${s.id} est de côté (Off) : il ne lit rien — cliquer pour le remettre (On)` : `${s.id} lit (On) — cliquer pour le mettre de côté (Off) sans le perdre`),
        el("button", { class: "icon-btn", type: "button", "aria-label": `Dupliquer ${s.id}`, "data-tip": `Dupliquer ${s.id} : la copie naît à Off, au même point — déplacez-la, ou tournez-la, puis mettez-la à On`, style: { fontSize: ".95rem" }, onClick: () => { copySensor(list, i); o.apply(list[i + 1]); } }, icon("copy")),
        el("button", { class: "icon-btn", type: "button", "aria-label": `Retirer ${s.id}`, "data-tip": "Retirer", onClick: () => { list.splice(i, 1); o.apply(); } }, "×")),
      el("div", { class: "bc-row" }, el("small", { class: "grow" }, "point — X, Y, Z (mm)"), btn("Viser", () => o.aim((p, n, body) => set({ at: p.map(r2), ...(s.kind === "gauge" && n ? { n: n.map((v) => Math.round(v * 1e4) / 1e4) } : {}), ...(body ? { body } : {}) })), { small: true, icon: "fit", tip: "Le déplacer : cliquez un point de la pièce, sur le modèle ou sur le résultat" })),
      el("div", { class: "bc-row", style: { flexWrap: "nowrap" } }, coord(0), coord(1), coord(2)));
    if (s.kind === "gauge") {
      const ask = asksAngle(s), input = el("input", { type: "number", value: Number(s.angle) || 0, step: 5, "aria-label": `Axe de ${s.id} (degrés)`, "data-field": "angle", style: { flex: "1 1 3rem", width: "3rem", minWidth: 0 }, onChange: (e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) turn(v); }, onKeydown: (e) => { if (e.key === "Enter" && ask) turn(Number(s.angle) || 0); } });
      card.append(el("div", { class: "bc-row", style: { flexWrap: "nowrap" } }, el("small", { style: { flex: "0 0 2.4rem" } }, "axe"), ask ? needField(input, { hint: "Axe d'exemple : tournez la jauge, ou confirmez cet axe (Entrée, ou la coche) — sa lecture attend" }) : input, el("small", null, "°"),
          ...(ask ? [el("button", { class: "icon-btn ask-ok", type: "button", "aria-label": `Garder ${fr(Number(s.angle) || 0)}°`, "data-tip": "Garder cet axe", onClick: () => turn(Number(s.angle) || 0) }, icon("check"))] : []),
          ...[0, 45, 90].map((deg) => el("button", { class: "chip-btn" + (!ask && (Number(s.angle) || 0) === deg ? " on" : ""), type: "button", "aria-pressed": !ask && (Number(s.angle) || 0) === deg ? "true" : "false", "data-tip": `Axe à ${deg}°`, onClick: () => turn(deg) }, `${deg}°`))),
        el("div", { class: "bc-row", style: { flexWrap: "nowrap" } }, el("small", { style: { flex: "0 0 2.4rem" } }, "grilles"),
          el("div", { class: "seg text", role: "group", "aria-label": "Grilles de la jauge" }, [[false, "Uniaxial", "Uniaxial — une grille : la déformation le long de son axe"], [true, "Rosette", `${ROSETTE.label} — ${ROSETTE.fr} : trois grilles, les deux déformations principales et leur direction`]].map(([ros, text, tip]) => el("button", { class: "seg-btn" + (!!s.rosette === ros ? " on" : ""), type: "button", "aria-pressed": !!s.rosette === ros ? "true" : "false", "data-tip": tip, onClick: () => { if (ros) s.rosette = true; else delete s.rosette; o.apply(); } }, text)))),
        el("p", { class: "muted small", style: { margin: ".15rem 0 0" } }, `0° : le long de ${AX[tangent(s.n).axis]}, dans le plan de la face ; 90° : en travers.`));
    }
    /* its reading, or why there is none */
    const ok = row.state === "ok", notes = !ok ? [] : [row.mirrored ? "lu par symétrie" : "", row.zone ? "dans une zone de raffinement" : "", row.dist > 0.05 ? `sur le cube le plus proche, à ${fr(row.dist)} mm` : "", o.stale ? "résultat d'avant" : ""].filter(Boolean);
    const why = s.off ? "Off — de côté : il ne lit rien. Son point reste, pour le remettre." : !reads ? `${K.label} : ${K.waits}.` : row.state === "none" || !o.has ? "Pas encore de résultat : lancez la simulation, il se lira dessus." : row.state === "idle" ? `Le résultat gardé est d'une autre physique : il ${K.waits} — relancez la simulation.` : sensorText(row);
    card.append(el("p", { class: "sensor-read" + (ok ? " ok" : ""), style: { margin: ".25rem 0 0" } }, ok ? el("b", null, sensorText(row)) : el("span", { class: row.state === "cut" || row.state === "far" ? "form-error small" : "muted small" }, why), ...(notes.length ? [el("small", { class: "muted" }, ` — ${notes.join(", ")}`)] : [])),
      ...rosetteLines(row).map((t) => el("p", { class: "muted small", style: { margin: ".1rem 0 0" } }, t)));
    rows.push(card);
  });
  rows.push(el("p", { class: "muted small" }, list.length ? "Un instrument se lit sur le résultat gardé : posez-le, déplacez-le, tournez une jauge — sa lecture suit, sans relancer. Il ne change rien au calcul."
    : `Ce que diraient les capteurs du banc d'essai, avant le banc : ${o.kinds.map((k) => `${SENSOR_KINDS[k].label} (${SENSOR_KINDS[k].tag})`).join(", ")}. Un clic droit sur la pièce → « Instrumenter ici », ou le « + » puis un clic — sur le modèle ou sur le résultat.`));
  sec.append(...rows); sec.setAttribute("data-fold-note", sensorNote(list) || "aucun");
  return sec;
}

/** What a right click offers : an instrument at the point shown. kinds : what the physics reads ; put(kind). */
export function sensorMenu(kinds, put) {
  return kinds.length ? [{ title: "Instrumenter ici" }, ...kinds.map((k) => ({ label: `${SENSOR_KINDS[k].label} ici (${SENSOR_KINDS[k].tag})`, icon: k === "temp" ? "thermal" : "sensor", run: () => put(k) }))] : [];
}

/** Draws the instruments in the view : a point, the axis of a gauge, a tag — with its reading on a result.
    o : { shown (false : only the one under the pointer), lit (the instrument the pointer is on), result (the view is a result : drawn on the
    deformed shape), kinds (what the view reads : the others are left out, but under the pointer), onClick(sensor) } */
export function drawSensors(viewer, sensors, rows, o = {}) {
  viewer.clearOverlays("sensor");
  (sensors || []).forEach((s, i) => {
    const K = SENSOR_KINDS[s.kind], strong = !!(o.lit && o.lit.id === s.id); if (!K || (!strong && (s.off || o.shown === false || (o.kinds && !o.kinds.includes(s.kind))))) return;      // what this view cannot read stays out of it
    const row = rows && rows[i], read = !!(o.result && row && row.state === "ok"), p = read ? row.shown : s.at;
    viewer.addMarker(p, K.color, "sensor", strong ? 1.5 : 1.1);
    if (s.kind === "gauge") { const L = viewer._size() * (strong ? 0.034 : 0.026); gaugeAxes(s).forEach((d, k) => viewer.addPath([p.map((v, j) => v - (k ? 0 : L) * d[j]), p.map((v, j) => v + L * d[j])], K.color, "sensor", strong ? 0.9 : 0.6, asksAngle(s))); }      // a rosette : its first grid through the point, the two others fanned from it ; dashed while the axis is an example
    const b = viewer.addLabel(p, read ? `${s.id} · ${sensorText(row)}` : asksAngle(s) ? `${s.id} · axe ?` : s.id, "sensor", `bc sensor${strong ? " sel" : ""}`, o.onClick ? () => o.onClick(s) : null);
    if (b) { b.style.borderColor = K.color; b.style.setProperty("--bc", K.color); b.dataset.tip = `${kindTip(s)}${s.name ? ` — ${s.name}` : ""}`; b.setAttribute("aria-label", `${s.id}, ${K.fr}${s.name ? `, ${s.name}` : ""}${read ? ` : ${sensorText(row)}` : ""}`); }
  });
}

/** What the result panel says of the instruments of a run. o : { sensors, rows (read on the run shown), prev (read on the trial before, or null),
    prevN (its number), thermo (the part is heated : a gauge reads the expansion too) } → element, or null when the run reads none */
export function sensorsResult(o) {
  const shown = (o.sensors || []).map((s, i) => ({ s, row: o.rows[i], was: o.prev ? o.prev[i] : null })).filter((x) => x.row && !["off", "idle", "none", "bad"].includes(x.row.state)); if (!shown.length) return null;
  const gap = (x) => { if (!x.was || x.was.state !== "ok" || x.row.state !== "ok") return "—"; const d = x.row.value - x.was.value, pct = Math.abs(x.was.value) > 1e-9 ? ` (${d > 0 ? "+" : ""}${Math.round(100 * d / Math.abs(x.was.value))} %)` : ""; return `${d > 0 ? "+" : d < 0 ? "−" : ""}${fr(Math.abs(d), x.row.kind === "temp" ? 1 : 0)} ${x.row.unit}${x.row.kind === "temp" ? "" : pct}`; };
  const head = ["", "Lecture", ...(o.prev ? [`Essai ${o.prevN}`, "Écart"] : [])], gauges = shown.some((x) => x.s.kind === "gauge");
  return el("div", { class: "side-section", "data-fold-note": `${shown.length} lecture${shown.length > 1 ? "s" : ""}` }, el("h3", null, "Instrumentation"),
    table(head, shown.map((x) => [el("span", null, el("b", { style: { color: SENSOR_KINDS[x.s.kind].color } }, x.s.id), x.s.name ? el("small", { class: "muted", style: { display: "block" } }, x.s.name) : null), el("span", { class: x.row.state === "ok" ? "" : "muted" }, sensorText(x.row)), ...(o.prev ? [x.was ? sensorText(x.was) : "—", gap(x)] : [])])),
    ...shown.flatMap((x) => rosetteLines(x.row).map((t, k) => el("p", { class: "muted small", style: { margin: ".1rem 0 0" } }, k ? t : `${x.s.id} — ${t}`))),
    el("p", { class: "muted small" }, `Lu au point de l'instrument, dans le cube du maillage qui le contient${gauges ? ` ; une jauge lit la déformation totale le long de son axe, en µm/m (10⁻⁶) — positive : la matière s'allonge${o.thermo ? " ; la dilatation thermique y est comprise" : ""}` : ""}. Sur un maillage grossier, une lecture près d'un détail (trou, congé, bord d'appui) est indicative : une zone de raffinement l'affine.`));
}
