/* DynamiteOrbit.ai — the « Impression » tab of a printed part : which way it stands in the machine. The six directions
   are measured on the mesh of the part (analysis/am_supports.js) and ranked, the cheapest first ; the one in use shows
   on the model — in red what must be supported, in blue what rests on the plate, an arrow for the top of the machine. A
   click on a direction writes it in the part (print.dir) : the routing sheet and the rule AM-13 follow. */

import { el, badge, icon } from "../core/dom.js";
import { store } from "../core/store.js";
import { AM_PROCESSES, amLimits } from "../cad/special_processes.js";
import { supportReport, rankDirections, buildDir, BUILD_DIRS, DIR_WORDS } from "../analysis/am_supports.js";
import { lightTriangles, arrow } from "../core/view_marks.js";

const n = (v, d = 0) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("fr-CA");
export const SUPPORT_COLOR = "#e5484d", PLATE_COLOR = "#2563eb";
export const isPrinted = (spec) => !!(spec && AM_PROCESSES[spec.process]);

export function printPanel(body, ctx) {
  const { st, id, vp } = ctx, v = vp.viewer, P = amLimits(st.spec.process, st.spec.material);
  const main = st.built && (st.built.bodies.find((b) => b.name === st.built.main) || st.built.bodies[0]), mesh = main && main.mesh;
  v.clearOverlays("am");
  if (!P || !mesh || !mesh.idx) { body.append(el("p", { class: "muted" }, "La pièce se construit…")); return; }
  const dir = buildDir(st.spec), o = { hole: P.hHole }, angle = P.supports ? P.overhang : 0, cur = supportReport(mesh, dir, angle, o), ranks = rankDirections(mesh, angle, o), best = ranks[0];
  /* on the model : what the direction in use leaves to support, what lies on the plate, and which way is up */
  const oid = `part/${main.name}`;
  if (P.supports) lightTriangles(v, oid, cur.flags, 1, { color: SUPPORT_COLOR, tag: "am" });
  lightTriangles(v, oid, cur.flags, 2, { color: PLATE_COLOR, tag: "am", opacity: 0.6 });
  const bb = main.bbox || st.built.bbox, b = BUILD_DIRS[dir], c = [0, 1, 2].map((k) => (bb[k] + bb[k + 3]) / 2), half = [0, 1, 2].map((k) => (bb[k + 3] - bb[k]) / 2), top = c.map((x, k) => x + b[k] * (half[k] + 0.22 * v._size()));
  arrow(v, top, b, { tag: "am", color: "#172b4d", len: v._size() * 0.16 }); v.addLabel(top, "haut de la machine", "am", "");
  v.invalidate();
  const set = (d) => store.updatePart(id, (x) => { x.print = { ...(x.print || {}), dir: d }; }, `${st.spec.id} : imprimée ${DIR_WORDS[d]}`);
  const dot = (color) => { const s = el("span", { class: "bc-dot", "aria-hidden": "true" }); s.style.background = color; return s; };
  body.append(el("div", { class: "side-section" }, el("h3", null, "Sens d'impression"),
    el("p", { class: "small", style: { margin: "0 0 .4rem" } }, el("b", null, P.label), P.supports ? ` — une surface à moins de ${P.overhang}° du plateau demande un support${P.hHole ? ` ; un trou horizontal jusqu'à Ø${n(P.hHole)} s'imprime rond` : ""}.` : " — aucun support : la poudre porte la pièce. Le sens joue sur la hauteur de fabrication."),
    el("div", { class: "atelier-chips" }, ...[P.supports ? el("span", { class: "chip" + (cur.area < 1 ? " done" : " bad") }, cur.area < 1 ? "Rien à supporter" : `${n(cur.area)} mm² à supporter`) : null, P.supports && cur.area >= 1 ? el("span", { class: "chip" }, `${n(100 * cur.share)} % de la surface`) : null,
      el("span", { class: "chip" }, `Hauteur ${n(cur.height, 1)} mm`), el("span", { class: "chip" }, `${n(cur.plate)} mm² sur le plateau`)].filter(Boolean)),
    el("p", { class: "muted small", style: { display: "flex", gap: ".4rem", alignItems: "center", flexWrap: "wrap" } }, dot(SUPPORT_COLOR), "à supporter", dot(PLATE_COLOR), "posé sur le plateau", icon("fit"), "tournez le modèle pour voir le dessous")));
  const list = el("div", { class: "side-section" }, el("h3", null, "Les six sens, du moins coûteux au plus coûteux"));
  for (const r of ranks) {
    const on = r.dir === dir, row = el("button", { class: "bc-item" + (on ? " sel" : ""), type: "button", "aria-pressed": on ? "true" : "false", "data-dir": r.dir, "data-tip": on ? "Le sens en service" : "Imprimer la pièce dans ce sens", onClick: () => { if (!on) set(r.dir); } },
      dot(P.supports && r.area >= 1 ? SUPPORT_COLOR : "#2ec27e"), el("span", { class: "bc-text" }, el("span", null, DIR_WORDS[r.dir]), el("small", null, `${P.supports ? (r.area < 1 ? "rien à supporter" : `${n(r.area)} mm² à supporter`) + " · " : ""}hauteur ${n(r.height, 1)} mm`)),
      ...[on ? badge("en service", "ok") : null, r === best && !on ? badge("conseillé", "info") : null].filter(Boolean));
    list.append(row);
  }
  body.append(list, el("p", { class: "muted small" }, "Mesuré sur la géométrie de la pièce : c'est une borne haute. Un pont court entre deux parois s'imprime sans support, et un support peut s'appuyer sur la pièce plutôt que sur le plateau — le logiciel de l'imprimeur a le dernier mot. Le sens choisi s'écrit dans la pièce : la gamme le reprend."));
}
