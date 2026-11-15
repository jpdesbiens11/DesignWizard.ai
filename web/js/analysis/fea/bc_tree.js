/* DesignWizard.ai — the load case of a simulation as a tree : supports, loads, heat sources, imposed temperatures. Each item
   has its number (A1, E1, Q1, T1), its plain words and the colour of its type. Pure : the screen draws the tree, the 3D
   view takes the same numbers, labels and colours. */

/** One colour per type, the same in the tree, on the symbols and on the labels of the view. */
export const BC_COLORS = { fixed: "#2563eb", force: "#e5484d", pressure: "#f59e0b", power: "#f97316", fixedT: "#0ea5e9" };
export const BC_GROUPS = [
  { key: "fixed", fr: "Appuis", one: "un appui", tag: "A", color: BC_COLORS.fixed, tip: "Là où le produit est tenu : encastrement (cônes bleus)" },
  { key: "loads", fr: "Efforts", one: "un effort", tag: "E", color: BC_COLORS.force, tip: "Forces (flèches rouges) et pressions (flèches orange)" },
  { key: "power", fr: "Sources de chaleur", one: "une source", tag: "Q", color: BC_COLORS.power, tip: "Puissance dissipée sur une face" },
  { key: "fixedT", fr: "Températures imposées", one: "une température", tag: "T", color: BC_COLORS.fixedT, tip: "Face tenue à une température" },
];
const heated = (st) => st.kind === "thermal" || (st.kind === "thermo" && !(st.thermo && st.thermo.uniform));
/** The groups a physics shows : a structure has supports and loads, a thermal case sources and temperatures. */
export function bcGroups(st) { const heat = heated(st); return BC_GROUPS.filter((g) => (g.key === "fixed" ? st.kind !== "thermal" : g.key === "loads" ? st.kind === "structure" : heat)); }
const n = (v, d = 3) => String(Math.round(v * 10 ** d) / 10 ** d).replace(".", ","), dirFr = (d) => `${d[0] === "-" ? "−" : "+"}${d[1]}`;
/** The tree : [{ ...group, items: [{ id, index, region, where, text, short, color, kind, ask (values still to enter) }] }].
    labelOf(regionKey) → the plain name of a region (a face, an interface). */
export function bcTree(st, labelOf = (k) => k) {
  return bcGroups(st).map((g) => ({ ...g, items: (st[g.key] || []).map((x, i) => {
    const id = `${g.tag}${i + 1}`, region = g.key === "fixed" ? x : x.region, base = { id, index: i, region, where: labelOf(region), ask: g.key === "fixed" || !Array.isArray(x.ask) ? [] : x.ask };
    if (g.key === "fixed") return { ...base, text: "Encastrement", short: id, color: g.color, kind: "fixed" };
    if (g.key === "loads") return x.mode === "pressure" ? { ...base, text: `Pression ${n(x.p)} MPa`, short: `${id} · ${n(x.p)} MPa`, color: BC_COLORS.pressure, kind: "pressure" }
      : { ...base, text: `Force ${n(x.F, 1)} N vers ${dirFr(x.dir)}`, short: `${id} · ${n(x.F, 1)} N ${dirFr(x.dir)}`, color: BC_COLORS.force, kind: "force" };
    if (g.key === "power") return { ...base, text: `Source ${n(x.P, 1)} W`, short: `${id} · ${n(x.P, 1)} W`, color: g.color, kind: "power" };
    return { ...base, text: `Température ${n(x.T, 1)} °C`, short: `${id} · ${n(x.T, 1)} °C`, color: g.color, kind: "fixedT" };
  }) }));
}
/** The item a number names : { group, item } — null when it is gone. */
export function bcFind(tree, id) { for (const g of tree) { const it = g.items.find((x) => x.id === id); if (it) return { group: g, item: it }; } return null; }
/** The labels the view shows : a whole type when its switch is on, and always the selected item. */
export function bcLabels(tree, show = {}, selected = null) {
  const out = [];
  for (const g of tree) for (const it of g.items) if (show[g.key] !== false || it.id === selected) out.push({ ...it, group: g.key, selected: it.id === selected });
  return out;
}
