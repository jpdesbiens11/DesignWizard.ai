/* DynamiteOrbit.ai — Logiciel, Missions : THE PROFILE GRAPH of a mission (JP, 27 novembre 2026 : « pouvoir directement voir les tags des requis dans
   le graph temporel du profil de mission »). What the mission imposes on the bench, lane by lane — the current (+ discharge, − charge), the
   hottest cell (heat from outside), the cell block the cell emulator holds — as steps in time ; on each lane, DASHED, the limits of the
   requirements the mission aims at, each tagged with its key and coloured by its verdict on this mission once the campaign is played (green
   held, red failed, grey not exercised ; blue before the campaign). The events above, the crossings in red. Read from sw/sw_mission_plan.js
   (profileSeries, tagLines) ; nothing is played here — what the module DID is on the bench's Mission view. What it follows : the stimulus plot
   of a test case, limits drawn as dashed reference lines with their tag (the convention of the bench's Mission view, modules/sw_mission.js). */

import { svg } from "../core/dom.js";
import { profileSeries, tagLines, LANES } from "../sw/sw_mission_plan.js";

const VC = { pass: "#16a34a", fail: "#dc2626", none: "#94a3b8", covered: "#0891b2", uncovered: "#d97706" };
const fr = (x) => String(+(+x).toFixed(2)).replace(".", ",");
const mins = (s) => (s >= 120 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`);

/** The graph of a mission. p : a mission ; R : the requirements ; C : the last campaign or null ; C1 : 1 C (A) ; amb : the ambient (°C). */
export function missionGraph(p, R, C = null, C1 = 36, amb = 25) {
  const G = profileSeries(p, C1, amb), T = tagLines(p, R, C);
  /* a limit on a quantity the mission does not impose (a nominal charge : the cell blocks) : its lane carries only the dashed tags */
  for (const k of ["i", "t", "v"]) if (T.some((x) => x.lane === k) && !G.lanes.some((l) => l.key === k)) G.lanes.push({ key: k, ...LANES[k], note: "jugée par le banc, non imposée", pts: [] });
  G.lanes.sort((a, b) => "itv".indexOf(a.key) - "itv".indexOf(b.key));
  const W = 600, L = 46, Rm = 92, top = 26, laneH = 46, gap = 20, end = Math.max(1, G.end), X = (t) => L + (t / end) * (W - L - Rm);
  const H = top + G.lanes.length * (laneH + gap) + 14, kids = [];
  kids.push(...G.marks.map((m) => svg("circle", { cx: X(m.t), cy: 6, r: m.cross ? 4 : 2.6, class: m.cross ? "swg-ev hit" : "swg-ev" }, svg("title", null, `${mins(m.t)} — ${m.title}`))));
  G.lanes.forEach((ln, k) => {
    const y0 = top + k * (laneH + gap), tags = T.filter((x) => x.lane === ln.key), vals = [...ln.pts.map((q) => q[1]).filter((v) => v !== null), ...tags.map((x) => x.value), ...(ln.key === "i" ? [0] : [])];
    let lo = Math.min(...vals), hi = Math.max(...vals); if (hi - lo < 1e-9) { lo -= 1; hi += 1; } const pad = (hi - lo) * 0.15; lo -= pad; hi += pad;
    const Y = (v) => y0 + laneH - ((v - lo) / (hi - lo)) * laneH;
    kids.push(svg("rect", { x: L, y: y0, width: W - L - Rm, height: laneH, class: "swg-lane" }), svg("text", { x: L - 4, y: y0 + 9, class: "swg-unit", "text-anchor": "end" }, ln.unit),
      svg("text", { x: L, y: y0 - 4, class: "swg-label" }, `${ln.label} — ${ln.note}`));      // above its lane : never under a dashed limit
    if (ln.key === "i" && lo < 0 && hi > 0) kids.push(svg("line", { x1: L, x2: W - Rm, y1: Y(0), y2: Y(0), class: "swg-zero" }));
    /* the steps : a null (the emulator off) breaks the line */
    let d = "", was = null;
    ln.pts.forEach(([t, v], i) => { const nx = ln.pts[i + 1] ? ln.pts[i + 1][0] : end; if (v === null) { was = null; return; } d += `${was === null ? `M${X(t).toFixed(1)} ${Y(v).toFixed(1)}` : `V${Y(v).toFixed(1)}`}H${X(nx).toFixed(1)}`; was = v; });
    if (d) kids.push(svg("path", { d, class: `swg-step ${ln.key}` }));
    /* the limits of the requirements : dashed, tagged with the key ; two tags at the same height stand side by side */
    const seen = new Map();
    for (const x of tags) { const y = Y(x.value), c = VC[x.verdict] || "#2563eb", n = seen.get(Math.round(y)) || 0; seen.set(Math.round(y), n + 1);
      kids.push(svg("line", { x1: L, x2: W - Rm, y1: y, y2: y, class: "swg-tag", style: `stroke:${c}` }),
        svg("g", { class: "swg-key", "data-tag": x.key }, svg("rect", { x: W - Rm + 3 + 0, y: y - 6 + n * 12, width: Rm - 6, height: 11, rx: 3, style: `stroke:${c}` }),
          svg("text", { x: W - Rm + 6, y: y + 2.5 + n * 12, style: `fill:${c}` }, `${x.key} · ${fr(x.value)}`),
          svg("title", null, `${x.key} : ${fr(x.value)} ${ln.unit}${x.verdict ? ` — ${x.verdict === "pass" ? "tenue" : x.verdict === "fail" ? "échoue" : x.verdict === "covered" ? "atteinte" : "non exercée"} sur cette mission` : ""}`))); }
  });
  kids.push(svg("text", { x: L, y: H - 2, class: "swg-unit" }, "0"), svg("text", { x: W - Rm, y: H - 2, class: "swg-unit", "text-anchor": "end" }, mins(end)));
  return svg("svg", { class: "swg", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Profil de la mission : ${G.lanes.map((l) => l.label).join(", ")} ; ${T.length} limite${T.length > 1 ? "s" : ""} d'exigences taguées`, "data-sw-graph": String(T.length) }, ...kids);
}
