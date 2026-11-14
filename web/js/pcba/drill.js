/* DesignWizard.ai — PCBA: drill files in the Excellon format every board shop reads : metric, absolute, explicit
   decimal coordinates in millimetres, one tool per diameter. Plated and non-plated holes go to separate files. */

const d3 = (v) => (Math.round(v * 1000) / 1000).toFixed(3);

/** Tools of a set of drills : [{ tool, d, plated, count }], smallest first. */
export function drillTable(drills) {
  const by = new Map();
  for (const h of drills) { const key = `${h.plated ? "P" : "N"}${d3(h.d)}`; if (!by.has(key)) by.set(key, { d: +d3(h.d), plated: !!h.plated, count: 0 }); by.get(key).count++; }
  const list = [...by.values()].sort((a, b) => (a.plated === b.plated ? a.d - b.d : a.plated ? -1 : 1));
  let p = 0, n = 0;
  return list.map((t) => ({ tool: t.plated ? ++p : ++n, ...t }));
}

/** An Excellon file for the plated holes (plated: true) or the non-plated ones. Layers go from 1 to `layers`. */
export function excellon(drills, { plated = true, layers = 2, project = "", date = new Date(0) } = {}) {
  const mine = drills.filter((h) => !!h.plated === plated), tools = drillTable(mine), out = ["M48", `; ${project} — ${plated ? "trous métallisés" : "trous non métallisés"} — ${date.toISOString().slice(0, 10)}`,
    `; #@! TF.GenerationSoftware,DesignWizard.ai,PCBA,1`, `; #@! TF.FileFunction,${plated ? "Plated" : "NonPlated"},1,${layers},${plated ? "PTH" : "NPTH"}`, "FMAT,2", "METRIC,TZ"];
  for (const t of tools) out.push(`T${t.tool}C${d3(t.d)}`);
  out.push("%", "G90", "G05");
  for (const t of tools) { out.push(`T${t.tool}`); for (const h of mine) if (Math.abs(h.d - t.d) < 5e-4) out.push(`X${d3(h.x)}Y${d3(h.y)}`); }
  out.push("T0", "M30", "");
  return out.join("\n");
}
