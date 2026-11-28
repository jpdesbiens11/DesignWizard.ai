/* DynamiteOrbit.ai — PCBA: Gerber writer (RS-274X with X2 attributes), from the primitives of art.js.
   Format : millimetres, absolute, 4 integer and 6 decimal digits (%FSLAX46Y46*%). Standard apertures only — circle,
   rectangle, obround — flashed (D03) for lands, drawn (D01) with a circle for tracks, G36/G37 regions for polygons,
   %LPC*% for the primitives that remove copper. No arc is needed : rounded outlines are already chords. */

const n6 = (v) => String(Math.round(v * 1e6));
const f = (v) => (Math.round(v * 1e6) / 1e6).toFixed(6);
const safe = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w .+\-]/g, "_");

/** A stable pseudo-GUID for the project attribute, from the board number. */
function guid(text) {
  let h = [0x811c9dc5, 0x01000193, 0xdeadbeef, 0x41c64e6d];
  for (const ch of String(text)) h = h.map((x, i) => Math.imul(x ^ (ch.charCodeAt(0) + i * 31), 16777619) >>> 0);
  const hex = h.map((x) => x.toString(16).padStart(8, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** A Gerber file. opts : { function: "Copper,L1,Top" | "Soldermask,Top" | "Legend,Top" | "Paste,Top" | "Profile,NP" | "Other,…",
    polarity, project, revision, date (Date), software, nets (write the net of each copper object) }. */
export function gerber(prims, opts = {}) {
  const head = ["%TF.GenerationSoftware,DynamiteOrbit.ai,PCBA,1*%", `%TF.CreationDate,${(opts.date || new Date(0)).toISOString().replace(/\.\d+Z$/, "+00:00")}*%`,
    `%TF.ProjectId,${safe(opts.project || "carte")},${guid(opts.project || "carte")},${safe(opts.revision || "A")}*%`, "%TF.SameCoordinates,Original*%",
    `%TF.FileFunction,${opts.function || "Other,Dessin"}*%`, `%TF.FilePolarity,${opts.polarity || "Positive"}*%`, "%FSLAX46Y46*%", "%MOMM*%", "G01*"];
  const aps = new Map(), body = [];
  const ap = (def) => { if (!aps.has(def)) aps.set(def, 10 + aps.size); return aps.get(def); };
  let cur = -1, dark = true, net;
  const use = (d) => { if (d !== cur) { body.push(`D${d}*`); cur = d; } };
  const pol = (clear) => { if (dark === !clear) return; dark = !clear; body.push(dark ? "%LPD*%" : "%LPC*%"); };
  const tag = (p) => { if (!opts.nets) return; const want = p.clear ? undefined : p.net || undefined; if (want === net) return; if (net !== undefined) body.push("%TD*%"); net = want; if (net !== undefined) body.push(`%TO.N,${safe(net)}*%`); };
  for (const p of prims) {
    pol(p.clear); tag(p);
    if (p.t === "pad") {
      const round = (p.shape || "rect") !== "rect";
      use(ap(round ? (Math.abs(p.w - p.h) < 1e-9 ? `C,${f(p.w)}` : `O,${f(p.w)}X${f(p.h)}`) : `R,${f(p.w)}X${f(p.h)}`));
      body.push(`X${n6(p.x)}Y${n6(p.y)}D03*`);
    } else if (p.t === "circle") { use(ap(`C,${f(p.d)}`)); body.push(`X${n6(p.x)}Y${n6(p.y)}D03*`); }
    else if (p.t === "track") {
      use(ap(`C,${f(p.w)}`));
      const pts = p.pts.filter((q, i) => i === 0 || Math.hypot(q[0] - p.pts[i - 1][0], q[1] - p.pts[i - 1][1]) > 1e-9);
      if (pts.length < 2) body.push(`X${n6(pts[0][0])}Y${n6(pts[0][1])}D03*`);
      else pts.forEach((q, i) => body.push(`X${n6(q[0])}Y${n6(q[1])}D0${i ? 1 : 2}*`));
    } else if (p.t === "region") {
      body.push("G36*");
      p.pts.forEach((q, i) => body.push(`X${n6(q[0])}Y${n6(q[1])}D0${i ? 1 : 2}*`));
      body.push(`X${n6(p.pts[0][0])}Y${n6(p.pts[0][1])}D01*`, "G37*");
    }
  }
  if (net !== undefined) body.push("%TD*%");
  if (!dark) body.push("%LPD*%");
  return [...head, ...[...aps].map(([def, d]) => `%ADD${d}${def}*%`), ...body, "M02*", ""].join("\n");
}
