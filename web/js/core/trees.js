/* DesignOrbit.ai — lists as trees : what a screen has many of is filed by state or by type, each group with its colour, each
   item with its number, its few words and the colour of its group — the same look as the tree of the mates (Assembly) and
   of the load case (Simulation). Three models here : the pairs of nets of the Isolation by verdict, the dimensions of a
   drawing by nature, the findings of a board by severity. Pure : a screen draws the tree (modules/state_tree.js). */

export const STATE_COLORS = { fail: "#e5484d", check: "#f59e0b", todo: "#94a3b8", ok: "#2ec27e", info: "#64748b" };
/** Is the eye of a group open ? Unless the designer said otherwise, what is wrong shows and what is sound stays quiet. */
export const treeShown = (show, key, open = ["fail"]) => (show && Object.prototype.hasOwnProperty.call(show, key) ? !!show[key] : open.includes(key));
/** The item an id names, or null. */
export function treeFind(tree, id) { for (const g of tree || []) { const it = g.items.find((x) => x.id === id); if (it) return it; } return null; }
const file = (groups, items) => groups.map((g) => ({ ...g, items: items.filter((x) => x.state === g.key).map((x) => ({ ...x, color: x.color || g.color })) }));

/* ---------- Isolation : the pairs of nets, by verdict ---------- */
export const PAIR_GROUPS = [
  { key: "fail", fr: "Non conformes", color: STATE_COLORS.fail, tip: "Une distance mesurée — clearance ou creepage — est sous la distance requise" },
  { key: "check", fr: "À vérifier", color: STATE_COLORS.check, tip: "La mesure a échoué, ou le verdict ne peut pas être rendu" },
  { key: "todo", fr: "À mesurer", color: STATE_COLORS.todo, tip: "L'analyse n'a pas encore mesuré cette paire" },
  { key: "ok", fr: "Conformes", color: STATE_COLORS.ok, tip: "Clearance et creepage respectent les distances requises" },
];
/** The state of a pair from its result : "fail" | "check" | "todo" | "ok". r : { verdict { ok }, error } or nothing. */
export const pairState = (r) => (!r ? "todo" : r.error ? "check" : r.verdict && r.verdict.ok === false ? "fail" : r.verdict && r.verdict.ok === true ? "ok" : "check");
/** The tree of the pairs. pairs : [{ a, b, level, req { u_rms, clearance_mm } }] ; results : [{ a, b, verdict, error }] ;
    o : { key(a, b), fmt(value, digits), levels { level : label } }.
    → [{ key, fr, color, tip, items : [{ id, state, color, text, sub, a, b }] }] — every state, even empty */
export function pairTree(pairs, results, o = {}) {
  const key = o.key || ((a, b) => [a, b].sort().join("|")), f = o.fmt || ((v, d = 2) => Number(v).toFixed(d)), by = new Map((results || []).map((r) => [key(r.a, r.b), r]));
  const got = (v, capped) => (v === null || v === undefined ? (capped ? "> plafond" : "—") : f(v, 2));
  const items = (pairs || []).map((p) => { const id = key(p.a, p.b), r = by.get(id), state = pairState(r), v = (r && r.verdict) || {}, lvl = (o.levels || {})[p.level] || p.level || "";
    const sub = !r ? `${f(p.req.u_rms, 0)} V · ${lvl} — clearance ≥ ${f(p.req.clearance_mm, 2)} mm` : r.error ? String(r.error)
      : `clr ${got(v.clr, v.clrCapped)} / ${f(v.clrReq, 2)} mm · crp ${v.crpNone ? "aucun chemin" : `${got(v.crp, v.crpCapped)} / ${v.crpReq === null || v.crpReq === undefined ? "—" : f(v.crpReq, 2)} mm`}`;
    return { id, state, text: `${p.a} ↔ ${p.b}`, sub, a: p.a, b: p.b }; });
  return file(PAIR_GROUPS, items);
}

/* ---------- Drawings : the dimensions of a sheet, by nature ---------- */
export const DIM_GROUPS = [
  { key: "overall", fr: "Hors tout", color: "#2563eb", tip: "Les trois encombrements de la pièce" },
  { key: "pattern", fr: "Positions et entraxes", color: "#7c3aed", tip: "Où sont les interfaces : depuis un bord, d'un trou à l'autre" },
  { key: "hole", fr: "Trous", color: "#0891b2", tip: "Les perçages, groupés par diamètre" },
  { key: "detail", fr: "Cotes de détail", color: "#ea580c", tip: "Une cote placée sur une vue pour une forme : une poche, un rayon, une épaisseur" },
  { key: "def", fr: "Cotes de définition", color: "#64748b", tip: "Les paramètres de la pièce et de ses interfaces, au tableau" },
];
const DIM_KIND = { overall: "overall", pattern: "pattern", hole: "hole", detail: "detail" };
const CHIP = { ref: { text: "REF", tone: "neutral" }, sc: { text: "SC", tone: "warn" }, csc: { text: "CSC", tone: "danger" } };
/** The tree of the dimensions. dims : [{ key, n (balloon), kind, cls, text, label, table, basic }] ; onView : the keys shown on a view ;
    text(dim) → what the dimension reads. → groups with items [{ id, n, state, text, sub, cls, chip, where }] */
export function dimTree(dims, onView = [], text = (d) => d.text) {
  const on = new Set(onView), items = (dims || []).map((d) => ({ id: d.key, n: d.n, state: DIM_KIND[d.kind] || "def", text: text(d), sub: d.label || "", cls: d.cls || "normal", ...(CHIP[d.cls] ? { chip: CHIP[d.cls] } : {}),
    where: on.has(d.key) ? "sur une vue" : d.table === "holes" ? "au tableau des trous" : "au tableau des cotes de définition", basic: !!d.basic }));
  return file(DIM_GROUPS, items);
}
/** How many dimensions carry each class : { normal, ref, sc, csc }. */
export const dimClasses = (dims) => (dims || []).reduce((n, d) => { const c = d.cls || "normal"; n[c] = (n[c] || 0) + 1; return n; }, { normal: 0, ref: 0, sc: 0, csc: 0 });

/* ---------- Board : the findings of the checks, by severity ---------- */
export const FINDING_GROUPS = [
  { key: "error", fr: "À corriger", color: STATE_COLORS.fail, tip: "La carte ne peut pas partir en fabrication telle quelle" },
  { key: "warn", fr: "À vérifier", color: STATE_COLORS.check, tip: "À regarder avant de lancer : un risque, pas un blocage" },
  { key: "info", fr: "Remarques", color: STATE_COLORS.info, tip: "Un conseil, pour la prochaine révision" },
];
/** The tree of the findings. findings : [{ rule, title, message, severity, at }] ; hint(f) → what to do about it ; say(text) → the sentence in the units shown.
    → groups with items [{ id (its rank in the list), state, text, sub, at, hint, finding }] */
export function findingTree(findings, hint = () => "", say = (t) => t) {
  const items = (findings || []).map((f, i) => ({ id: i, state: FINDING_GROUPS.some((g) => g.key === f.severity) ? f.severity : "info", text: `${f.rule || f.id || ""} · ${f.title || ""}`.replace(/^ · /, ""), sub: say(f.message || ""), at: f.at || null, hint: say(hint(f) || ""), finding: f }));
  return file(FINDING_GROUPS, items);
}
