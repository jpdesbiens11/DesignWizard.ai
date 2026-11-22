/* DynamiteOrbit — Dessins, what the right margin adds to the sheet (JP, 21 novembre 2026 : « tout texte de la feuille éditable dans la
   marge de droite… tolérances générales par défaut = bloc ASME… un outil pour choisir une zone → vue de détail ») : the tolerance block of
   the project and its example values to confirm, the general notes On / Off, and the detail views — the tool that draws a zone on a view,
   and the list of the details (scale, On / Off, copy, delete). Each change is one step of the store. */

import { el, btn, badge, field, onOff, icon, toast } from "../core/dom.js";
import { uosOf, uosLines, UOS_BASES, uosSummary } from "../draw/uos.js";
import { DETAIL_SCALES, scaleName, newDetail, copyDetail, detailScaleFor } from "../draw/detail_view.js";

const ISO_CLASSES = ["fH", "fK", "mH", "mK", "cL", "vL"];
const iconBtn = (name, tip, fn) => el("button", { class: "icon-btn", type: "button", "data-tip": tip, "aria-label": tip, onClick: (e) => { e.stopPropagation(); fn(); } }, icon(name));
/** The fields of a block, by basis : a key, its label, how to read it. */
const KEYS = { mm: [["mm0", "X", 0], ["mm1", "X.X", 1], ["mm2", "X.XX", 2]], inch: [["in0", "X.XX", 0], ["in1", "X.XXX", 1]] };

/** The tolerance block « UNLESS OTHERWISE SPECIFIED » : its basis, its values — examples that flash until they are entered or confirmed.
    d : project.drawing ; set(uos, label) : one step ; inch : the drawing is in inches. */
export function uosSection(d, set, inch) {
  const u = uosOf(d), raw = (d && d.uos) || {}, entered = new Set(raw.entered || []), unit = inch ? "inch" : "mm";
  const keys = u.basis === "iso2768" ? ["iso", "angle"] : [...KEYS[unit].map((k) => k[0]), "angle"], waiting = u.sure ? [] : keys.filter((k) => !entered.has(k));
  const save = (patch, label, key) => { const e = new Set(entered); if (key) e.add(key); const next = { ...raw, basis: u.basis, mm: u.mm, inch: u.inch, angle: u.angle, iso: u.iso, ...patch, entered: [...e] };
    next.sure = u.sure || keys.every((k) => e.has(k)); set(next, label); };
  const mark = (input, key) => { input.classList.toggle("eg", waiting.includes(key)); input.classList.toggle("need", waiting[0] === key); return input; };
  const num = (key, label, value, write) => field(label, mark(el("input", { type: "number", min: 0, step: "any", value, "data-field": `uos:${key}`, "aria-label": `Tolérance ${label}`,
    onChange: (e) => { const v = +e.target.value; if (Number.isFinite(v) && v > 0) save(write(v), `tolérance ${label} = ±${v}`, key); },
    onKeydown: (e) => { if (e.key === "Enter" && waiting.includes(key)) save({}, `tolérance ${label} confirmée`, key); } }), key), waiting.includes(key) ? "Exemple : entrez la vôtre, ou Entrée pour la garder" : null);
  const lines = el("pre", { class: "uos-preview", "aria-label": "Le bloc tel que la feuille l'écrit" }, uosLines(u, inch).join("\n"));
  const rows = u.basis === "iso2768"
    ? [el("div", { class: "form-row" }, field("Classe ISO 2768", mark(el("select", { "data-field": "uos:iso", "aria-label": "Classe ISO 2768", onChange: (e) => save({ iso: e.target.value }, `ISO 2768-${e.target.value}`, "iso") },
        ISO_CLASSES.map((c) => el("option", { value: c, selected: c === u.iso }, `ISO 2768-${c}`))), "iso")), num("angle", "Angles (°)", u.angle, (v) => ({ angle: v })))]
    : [el("div", { class: "form-row" }, ...KEYS[unit].map(([key, label, i]) => num(key, label, u[unit][i], (v) => ({ [unit]: u[unit].map((x, j) => (j === i ? v : x)) })))), num("angle", "Angles (°)", u.angle, (v) => ({ angle: v }))];
  return el("div", { class: "side-section uos-block", "data-fold-note": uosSummary(u, inch) }, el("h3", null, "Tolérances générales"),
    el("p", { class: "muted small" }, "Le bloc « UNLESS OTHERWISE SPECIFIED », à gauche du cartouche : une seule fois pour tous les dessins du projet. ", u.sure ? badge("valeurs du projet", "ok") : badge("valeurs d'exemple", "warn")),
    field("Base", el("select", { "data-field": "uos", "aria-label": "Base des tolérances générales", onChange: (e) => set({ ...raw, basis: e.target.value, entered: [], sure: false }, `tolérances générales : ${UOS_BASES[e.target.value].label}`) },
      Object.entries(UOS_BASES).map(([k, b]) => el("option", { value: k, selected: k === u.basis }, b.label))), UOS_BASES[u.basis].hint),
    ...rows, lines,
    u.sure ? null : el("div", { class: "form-actions" }, btn("Confirmer ces valeurs", () => set({ ...raw, basis: u.basis, mm: u.mm, inch: u.inch, angle: u.angle, iso: u.iso, sure: true }, "tolérances générales confirmées"), { small: true, primary: true, tip: "Les valeurs affichées deviennent celles du projet : la feuille ne dit plus « EXAMPLE »" })));
}

/** The general notes of the sheet, each On or Off for the project ; the notes of the part or the assembly stay below, in their own field. */
export function autoNotes(list, off, set) {
  const out = new Set(off || []);
  if (!list || !list.length) return null;
  return el("div", { class: "auto-notes" }, el("p", { class: "muted small", style: { margin: "0 0 .3rem" } }, "Notes générales, écrites par l'outil — à Off, elles ne vont plus sur les feuilles du projet :"),
    list.map((n, i) => el("div", { class: "auto-note" + (out.has(n.key) ? " off" : "") }, onOff(!out.has(n.key), (on) => { const next = new Set(out); if (on) next.delete(n.key); else next.add(n.key); set([...next], `note ${i + 1} ${on ? "On" : "Off"}`); }, `La note « ${n.key} »`),
      el("small", null, n.text))));
}

/** The detail views of a part : the tool, then one line each — letter, view, scale, On / Off, copy, delete. part : the part ; info : what the sheet drew ; update(fn, label) : one step ; pick() : starts the tool. */
export function detailSection(part, info, update, pick, picking) {
  const list = part.details || [], where = new Map(((info && info.details) || []).map((d) => [d.id, d]));
  const VIEW = { front: "FRONT", top: "TOP", right: "RIGHT" };
  return el("div", { class: "side-section", "data-fold-note": `${list.filter((d) => d.on !== false).length} vue(s) de détail` }, el("h3", null, `Vues de détail (${list.length})`),
    el("p", { class: "muted small" }, "Comme dans un modeleur : un cercle tracé sur une vue — son centre, puis son rayon — devient une vue agrandie, lettrée. Les vues de la feuille se replacent seules ; à l'étroit, elles descendent d'une échelle, puis le détail passe sur une feuille à part."),
    el("div", { class: "form-actions" }, btn(picking ? "Tracez le cercle sur la feuille… (Échap)" : "Choisir une zone", pick, { small: true, primary: !picking, icon: "search", tip: "Puis, sur la feuille : appuyez au centre de la zone, glissez jusqu'au rayon, relâchez. Échap annule.", cls: "detail-pick" })),
    list.map((d) => { const on = d.on !== false, w = where.get(d.id);
      return el("div", { class: "detail-row" + (on ? "" : " off"), "data-field": `detail:${d.id}` }, onOff(on, (v) => update((p) => { const x = (p.details || []).find((q) => q.id === d.id); if (x) { if (v) delete x.on; else x.on = false; } }, `détail ${d.letter} ${v ? "On" : "Off"}`), `La vue de détail ${d.letter}`),
        badge(d.letter, "info"), el("span", { class: "grow small" }, `sur ${VIEW[d.view] || d.view}${w && w.sheet > 1 ? ` · feuille ${w.sheet}` : ""}${w && w.dims && w.dims.length ? ` · ${w.dims.length} cote${w.dims.length > 1 ? "s" : ""}` : ""}`),
        d.place ? iconBtn("refresh", `Le détail ${d.letter} a été placé à la main : le remettre où la feuille est blanche`, () => update((p) => { const x = (p.details || []).find((q) => q.id === d.id); if (x) delete x.place; }, `détail ${d.letter} replacé seul`)) : null,
        el("select", { "aria-label": `Échelle du détail ${d.letter}`, onChange: (e) => update((p) => { const x = (p.details || []).find((q) => q.id === d.id); if (x) x.scale = +e.target.value; }, `détail ${d.letter} à ${scaleName(+e.target.value)}`) },
          DETAIL_SCALES.map(([k, n]) => el("option", { value: k, selected: Math.abs(k - d.scale) < 1e-9 }, n))),
        iconBtn("copy", `Copier le détail ${d.letter} (la copie naît à Off)`, () => update((p) => { const c = copyDetail(p, d); if (c) p.details.push(c); }, `détail ${d.letter} copié`)),
        iconBtn("trash", `Retirer le détail ${d.letter}`, () => update((p) => { p.details = (p.details || []).filter((q) => q.id !== d.id); if (!p.details.length) delete p.details; }, `détail ${d.letter} retiré`))); }));
}

/** The tool that draws the zone of a detail on the sheet : press at the centre on a view, drag to the radius, release. center : the centre of
    the screen (it holds the sheets) ; info() : what the sheet drew (layout.boxes, layout.transforms) ; done({ view, at, r }) ; stop() : the tool ends. */
export function detailPicker(center, info, done, stop) {
  let drag = null;
  const svgOf = (e) => e.target.closest && e.target.closest(".sheet-view"), first = () => center.querySelector(".sheet-view");
  const toSheet = (svg, e) => { const m = svg.getScreenCTM(); if (!m) return null; const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()); return [p.x, p.y]; };
  const down = (e) => {
    if (e.button !== 0) return; const svg = svgOf(e); if (!svg) return;
    e.stopPropagation(); e.preventDefault();
    if (svg !== first()) { toast("Une vue de détail se trace sur la première feuille, celle des vues.", "warn"); return; }
    const p = toSheet(svg, e), L = info() && info().layout; if (!p || !L) return;
    const view = Object.keys(L.boxes).find((v) => { const b = L.boxes[v]; return p[0] >= b.x && p[0] <= b.x + b.w && p[1] >= b.y && p[1] <= b.y + b.h; });
    if (!view) { toast("Commencez sur une vue — de face, de dessus ou de droite : le centre du cercle est le centre de la zone.", "warn"); return; }
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", p[0]); c.setAttribute("cy", p[1]); c.setAttribute("r", 0.5); c.setAttribute("fill", "none"); c.setAttribute("stroke", "#2563eb"); c.setAttribute("stroke-width", 0.5); c.setAttribute("stroke-dasharray", "3 1.5");
    svg.append(c); drag = { svg, p, view, c, r: 0 }; try { center.setPointerCapture(e.pointerId); } catch (err) { /* gone */ }
  };
  const move = (e) => { if (!drag) return; const q = toSheet(drag.svg, e); if (!q) return; drag.r = Math.hypot(q[0] - drag.p[0], q[1] - drag.p[1]); drag.c.setAttribute("r", Math.max(0.5, drag.r)); };
  const up = (e) => {
    if (!drag) return; e.stopPropagation(); const d = drag; drag = null; d.c.remove();
    const T = info().layout.transforms[d.view], r = Math.max(2, d.r);
    if (d.r < 2) toast("Cercle très petit : il prend 2 mm de rayon sur la feuille.", "info");
    done({ view: d.view, at: [T.x0 + (d.p[0] - T.ox) / T.s, T.y1 - (d.p[1] - T.oy) / T.s], r: r / T.s });
  };
  const key = (e) => { if (e.key === "Escape") { if (drag) { drag.c.remove(); drag = null; } end(); } };
  const end = () => { center.removeEventListener("pointerdown", down, true); center.removeEventListener("pointermove", move, true); center.removeEventListener("pointerup", up, true); document.removeEventListener("keydown", key, true); center.classList.remove("pick-zone"); stop(); };
  center.addEventListener("pointerdown", down, true); center.addEventListener("pointermove", move, true); center.addEventListener("pointerup", up, true); document.addEventListener("keydown", key, true); center.classList.add("pick-zone");
  return end;
}
/** A detail view moved by hand (the usage of the modellers : a detail, a section or an auxiliary view is dragged where one wants it ; the
    projected views stay aligned — ASME Y14.3, ISO 128 — and do not move). Press on a detail of the first sheet, drag, release : done(id, [x, y])
    gets the top-left corner, in mm of the sheet. A detail that cannot be moved there is kept inside the frame by the layout. → a function that removes it. */
export function detailMover(center, info, done) {
  let drag = null;
  const first = () => center.querySelector(".sheet-view"), toSheet = (svg, e) => { const m = svg.getScreenCTM(); if (!m) return null; const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()); return [p.x, p.y]; };
  const hit = (e) => { const svg = first(), I = info(); if (!svg || !I || !e.target.closest || e.target.closest(".sheet-view") !== svg || center.classList.contains("pick-zone")) return null; const p = toSheet(svg, e); if (!p) return null;
    const d = (I.details || []).find((x) => x.sheet === 1 && p[0] >= x.box.x && p[0] <= x.box.x + x.box.w && p[1] >= x.box.y && p[1] <= x.box.y + x.box.h); return d ? { d, p, svg } : null; };
  const down = (e) => { if (e.button !== 0) return; const h = hit(e); if (!h) return; e.stopPropagation(); e.preventDefault();
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect"); for (const [k, v] of Object.entries({ x: h.d.box.x, y: h.d.box.y, width: h.d.box.w, height: h.d.box.h, fill: "rgba(37,99,235,.08)", stroke: "#2563eb", "stroke-width": 0.5, "stroke-dasharray": "3 1.5" })) r.setAttribute(k, v);
    h.svg.append(r); drag = { ...h, r, dx: 0, dy: 0 }; try { center.setPointerCapture(e.pointerId); } catch (err) { /* gone */ } };
  const move = (e) => { if (!drag) { const h = hit(e); center.classList.toggle("over-detail", !!h); return; } const q = toSheet(drag.svg, e); if (!q) return; drag.dx = q[0] - drag.p[0]; drag.dy = q[1] - drag.p[1]; drag.r.setAttribute("x", drag.d.box.x + drag.dx); drag.r.setAttribute("y", drag.d.box.y + drag.dy); };
  const up = (e) => { if (!drag) return; e.stopPropagation(); const g = drag; drag = null; g.r.remove(); if (Math.hypot(g.dx, g.dy) < 1) return; done(g.d.id, [Math.round((g.d.box.x + g.dx) * 10) / 10, Math.round((g.d.box.y + g.dy) * 10) / 10]); };
  const key = (e) => { if (e.key === "Escape" && drag) { drag.r.remove(); drag = null; } };
  center.addEventListener("pointerdown", down, true); center.addEventListener("pointermove", move, true); center.addEventListener("pointerup", up, true); document.addEventListener("keydown", key, true);
  return () => { center.removeEventListener("pointerdown", down, true); center.removeEventListener("pointermove", move, true); center.removeEventListener("pointerup", up, true); document.removeEventListener("keydown", key, true); };
}
/** A new detail from a zone drawn on the sheet : the next letter, the scale twice that of the sheet or more. */
export function detailFrom(part, zone, sheetScale) { return newDetail(part, { ...zone, scale: detailScaleFor(sheetScale) }); }
