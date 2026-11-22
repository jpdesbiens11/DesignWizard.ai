/* DesignOrbit.ai — DFx : the board of the project. Every part and every assembly as one item with its points, so that
   the page opens on what has to be settled — the points to fix and to check, each with its explanation and its fix —
   and keeps what is in order apart. Pure : the page, the report and the tests read the same lists.
   item = { key, kind: "part" | "assembly", ref, name, process, score, errors, warnings, infos, state, points, metrics, broken }
   point = a finding of the rule engine + { item (key), n (its place among the points of its item) } */

export const DFX_FILTERS = [["todo", "À régler"], ["error", "À corriger"], ["warn", "À vérifier"], ["info", "Conseils"], ["pass", "Conformes"], ["all", "Tout"]];
export const DFX_STATES = { fail: { fr: "à corriger", tone: "danger", rank: 0 }, review: { fr: "à vérifier", tone: "warn", rank: 1 }, pass: { fr: "conforme", tone: "ok", rank: 2 } };
/* the pictogram of a process, among those of the sprite */
export const PROCESS_ICON = { cnc_milling: "mill", cnc_turning: "lathe", sheet_metal: "bend", laser_cut: "laser", extrusion_al: "extrusion", extrusion_plastic: "extrusion", injection_molding: "cast", die_casting: "cast", lp_die_casting: "cast", permanent_mold: "cast", sand_casting: "cast",
  fdm: "print3d", mjf: "print3d", sla: "print3d", lpbf: "print3d", pcb: "pcb", purchased: "library" };
const count = (list, sev) => list.filter((f) => f.severity === sev).length;

/** The items of the board, from what projectDfx returns ({ parts: [{ spec, res }], asms: [{ asm, res, error }] }) : the worst first,
    then by reference. A part that does not build is an item to fix, with the reason as its point. */
export function dfxItems(run) {
  const out = [];
  const push = (kind, ref, name, process, res, extra = {}) => {
    const found = (res && res.findings) || [], points = found.map((f, n) => ({ ...f, item: `${kind}:${ref}`, n }));
    const errors = count(points, "error"), warnings = count(points, "warn"), infos = count(points, "info"), state = errors ? "fail" : warnings ? "review" : "pass";
    out.push({ key: `${kind}:${ref}`, kind, ref, name: name || "", process: process || "", score: res && res.summary && typeof res.summary.score === "number" ? res.summary.score : null, errors, warnings, infos, state, points, unavailable: !!(res && res.unavailable), ...extra });
  };
  for (const p of (run && run.parts) || []) push("part", p.spec.id, p.spec.name, p.spec.process, p.res, { family: p.spec.family || "" });
  for (const a of (run && run.asms) || []) push("assembly", a.asm.id, a.asm.name, "", a.error ? { findings: [{ id: "ASM-00", severity: "error", category: "DFA", title: "Assembly cannot be evaluated", message: a.error, fix: null }], summary: null } : a.res, { metrics: (a.res && a.res.metrics) || {} });
  return out.sort((a, b) => DFX_STATES[a.state].rank - DFX_STATES[b.state].rank || (a.kind === b.kind ? 0 : a.kind === "part" ? -1 : 1) || (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
}
/** What the top of the page counts : { error, warn, info, todo (error + warn), pass (items in order), items, score (mean of the parts, or null) } */
export function dfxCounts(items) {
  const c = { error: 0, warn: 0, info: 0, todo: 0, pass: 0, items: items.length, score: null }, scores = [];
  for (const it of items) { c.error += it.errors; c.warn += it.warnings; c.info += it.infos; if (it.state === "pass") c.pass++; if (it.kind === "part" && it.score !== null) scores.push(it.score); }
  c.todo = c.error + c.warn; c.score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  return c;
}
/** What a filter shows : the items that have something for it, each with the points it keeps (none for « pass » : an item in order
    is a line, not a list). only : the key or the reference of one item — the page was opened on it. */
export function dfxView(items, filter = "todo", only = null) {
  const sev = { todo: ["error", "warn"], error: ["error"], warn: ["warn"], info: ["info"], all: ["error", "warn", "info"] }[filter];
  const list = only ? items.filter((it) => it.key === only || it.ref === only) : items;
  if (filter === "pass") return list.filter((it) => it.state === "pass").map((it) => ({ ...it, points: [] }));
  if (!sev) return [];
  return list.map((it) => ({ ...it, points: it.points.filter((f) => sev.includes(f.severity)) })).filter((it) => it.points.length || (filter === "all"));
}
/** Where a point is settled : the studio of its item, on its DFx tab. */
export function dfxHash(it) {
  const e = encodeURIComponent(it.ref);
  return it.kind === "assembly" ? `#/assembly/${e}` : it.family === "pcb" ? `#/pcb/${e}` : it.family === "extrusion" ? `#/extrusion/${e}` : `#/parts/${e}/dfx`;
}
/** The rule of a point, in the rule book ([{ rules: [{ id, why, limit, source }] }]) — null when the book does not have it. */
export function ruleOf(book, id) {
  for (const b of book || []) { const r = (b.rules || []).find((x) => x.id === id); if (r) return r; }
  return null;
}
/** What was measured against what is asked, as one short line ("" when the point carries no number). */
export function measureText(f, fmt = (v) => String(v)) {
  const u = f.unit ? ` ${f.unit}` : "", has = (v) => v !== null && v !== undefined && v !== "";
  return has(f.value) && has(f.limit) ? `Mesuré ${typeof f.value === "number" ? fmt(f.value) : f.value}${u} · limite ${typeof f.limit === "number" ? fmt(f.limit) : f.limit}${u}` : has(f.value) ? `Mesuré ${typeof f.value === "number" ? fmt(f.value) : f.value}${u}` : "";
}
/** What a fix would do, before it is applied. before, after : the findings of the part as it is and with the fix ; point : the
    finding the fix answers. → { ok (it adds nothing to fix), solved (the point is gone), added: [the points to fix it would create] } */
export function fixOutcome(before, after, point) {
  const key = (f) => `${f.id}|${f.feature ?? ""}|${f.iface ?? ""}`, had = new Set((before || []).filter((f) => f.severity === "error").map(key));
  const added = (after || []).filter((f) => f.severity === "error" && !had.has(key(f)));
  return { ok: !added.length, solved: !!point && !(after || []).some((f) => key(f) === key(point) && f.message === point.message), added };
}
