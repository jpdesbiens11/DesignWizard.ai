/* DynamiteOrbit — the load case of a simulation as a tree : supports, loads, heat sources, imposed temperatures. Each item
   has its number (A1, E1, Q1, T1), its plain words and the colour of its type. Pure : the screen draws the tree, the 3D
   view takes the same numbers, labels and colours. */

/** One colour per type, the same in the tree, on the symbols and on the labels of the view. */
export const BC_COLORS = { fixed: "#2563eb", force: "#e5484d", pressure: "#f59e0b", power: "#f97316", fixedT: "#0ea5e9" };
export const BC_GROUPS = [
  { key: "fixed", fr: "Appuis", one: "un appui", tag: "A", color: BC_COLORS.fixed, tip: "Là où le produit est tenu : encastrement, ou appui qui ne bloque que certaines directions (cônes bleus)" },
  { key: "loads", fr: "Efforts", one: "un effort", tag: "E", color: BC_COLORS.force, tip: "Forces (flèches rouges) et pressions (flèches orange)" },
  { key: "power", fr: "Sources de chaleur", one: "une source", tag: "Q", color: BC_COLORS.power, tip: "Puissance dissipée sur une face" },
  { key: "fixedT", fr: "Températures imposées", one: "une température", tag: "T", color: BC_COLORS.fixedT, tip: "Face tenue à une température" },
];
const heated = (st) => st.kind === "thermal" || (st.kind === "thermo" && !(st.thermo && st.thermo.uniform));
/** The groups a physics shows : a structure has supports and loads, a thermal case sources and temperatures. */
export function bcGroups(st) { const heat = heated(st); return BC_GROUPS.filter((g) => (g.key === "fixed" ? st.kind !== "thermal" : g.key === "loads" ? st.kind === "structure" : heat)); }
const n = (v, d = 3) => String(Math.round(v * 10 ** d) / 10 ** d).replace(".", ","), dirFr = (d) => `${d[0] === "-" ? "−" : "+"}${d[1]}`;

/** The six directions a force can simply take ; any other is its own vector (load.dir « free », load.vec). */
export const AXIS_DIRS = { "+X": [1, 0, 0], "-X": [-1, 0, 0], "+Y": [0, 1, 0], "-Y": [0, -1, 0], "+Z": [0, 0, 1], "-Z": [0, 0, -1] };
/** The direction a force pushes along, of length 1 : one of the six, or its own vector brought to length 1. null : it has none. */
export function loadDir(l) {
  if (!l) return null; if (l.dir !== "free") return AXIS_DIRS[l.dir] || null;
  const v = Array.isArray(l.vec) ? l.vec.map(Number) : [], len = Math.hypot(...v);
  return v.length === 3 && v.every((c) => Number.isFinite(c)) && len > 1e-9 ? v.map((c) => c / len) : null;
}
/** The direction a load takes to push INTO a face whose outward direction is `out` : an axis when the face is square to one, else its own vector. */
export function pushInto(out) {
  const v = out.map((c) => -c), a = v.map(Math.abs), k = a.indexOf(Math.max(...a));
  return a[k] >= 0.985 ? { dir: `${v[k] < 0 ? "-" : "+"}${"XYZ"[k]}` } : { dir: "free", vec: v.map((c) => Math.round(c * 1000) / 1000 || 0) };
}
/** « vers −Z », or « direction (0,5 ; 0 ; −0,866) ». */
export function dirText(l, short = false) {
  if (l.dir !== "free") return short ? dirFr(l.dir) : `vers ${dirFr(l.dir)}`;
  const u = loadDir(l); return u ? `${short ? "" : "direction "}(${u.map((c) => n(c).replace("-", "−")).join(" ; ")})` : "sans direction";
}
/** A support : the place it holds (its key) and the directions it blocks. An entry of st.fixed is a key — everything blocked — or
    { region, dofs: [x, y, z] }. */
export const supportKey = (x) => (x && typeof x === "object" ? x.region : x);
export const supportDofs = (x) => (x && typeof x === "object" && Array.isArray(x.dofs) && x.dofs.length === 3 ? x.dofs.map(Boolean) : [true, true, true]);
export function supportText(x) { const d = supportDofs(x), held = "XYZ".split("").filter((_, i) => d[i]); return held.length === 3 ? "Encastrement" : held.length ? `Appui : bloque ${held.join(" et ")}` : "Appui : ne bloque rien"; }
/* ---------- On / Off, and copies : several cases kept side by side, one solved at a time (demande de JP) ----------
   A condition put aside (off) stays in the case with its values and counts for nothing : not for the solver, not for the hand
   estimate, not for the guide. A copy is born off : one changes a value in it, turns it on in place of the first, and runs again. */
/** Is a condition put aside ? */
export const isOff = (x) => !!(x && typeof x === "object" && x.off);
/** The conditions of a list that count, each with its place in the list — its number is place + 1 : [[x, i]]. */
export const onOf = (list) => (list || []).map((x, i) => [x, i]).filter(([x]) => !isOff(x));
/** A condition turned off, or on again. key : its type (« fixed » : a support, which is a plain key while it is on and holds everything). */
export function withOff(x, off, key) {
  const next = x && typeof x === "object" ? { ...x } : { region: x };
  if (off) next.off = true; else delete next.off;
  return key === "fixed" && !next.off && supportDofs(next).every(Boolean) ? next.region : next;
}
/** The copy of a condition : the same place and values, put aside until it is turned on. */
export function copyOf(x) { const c = x && typeof x === "object" ? JSON.parse(JSON.stringify(x)) : { region: x }; c.off = true; return c; }
/** One condition on, the others of its list off : the gesture that goes from one case to the next. */
export const soloOn = (list, i, key) => (list || []).map((x, j) => withOff(x, j !== i, key));
/** The planes that count : a cut put aside (off) cuts nothing. */
export const liveCuts = (cuts) => (cuts || []).filter((c) => c && !c.off);
/** A plane turned on takes the place of the plane of the same axis that was on (one plane per axis) ; alone : every other plane goes off. → a new list */
export function cutOn(cuts, i, on, alone = false) {
  const me = (cuts || [])[i]; if (!me) return cuts || [];
  return cuts.map((c, j) => { if (j === i) { const n = { ...c }; if (on) delete n.off; else n.off = true; return n; } return on && !c.off && (alone || c.axis === me.axis) ? { ...c, off: true } : c; });
}
/** The case as it is solved, in a few words : « A1 · E2 Pression 0,004 MPa » — what a trial remembers of it. tree : bcTree(st) ;
    zones : the zones that count ; cuts : the planes that count (a plane of symmetry is already in the tree, as S1). */
export function caseWords(tree, zones = [], cuts = []) {
  const on = tree.flatMap((g) => g.items.filter((it) => !it.off)), off = tree.reduce((n, g) => n + g.items.filter((it) => it.off).length, 0), free = cuts.filter((c) => c && c.bc !== "sym");
  const cutId = (c) => `C${"XYZ"[c.axis]}`, at = (c) => String(Math.round(c.at * 100) / 100).replace(".", ",");
  return { ids: [...on.map((it) => it.id), ...free.map(cutId), ...zones.map((z) => z.id)].join(" "), text: [...on.map((it) => `${it.id} ${it.text}`), ...free.map((c) => `${cutId(c)} coupe ${"XYZ"[c.axis]} = ${at(c)} mm`), ...zones.map((z) => `${z.id} zone`)].join(" · "), off };
}
/** The tree : [{ ...group, items: [{ id, index, region, where, text, short, color, kind, off, ask (values still to enter) }] }].
    A plane of symmetry (st.cuts, bc « sym ») is a blocked boundary : it shows among the supports as S1, `locked` — it goes away
    with the symmetry only, never alone (item.kind « symmetry », item.index : its place in st.cuts).
    labelOf(regionKey) → the plain name of a region (a face, an interface). */
export function bcTree(st, labelOf = (k) => k) {
  const sym = (st.cuts || []).map((c, i) => ({ c, i })).filter(({ c }) => c && !c.off && c.bc === "sym").map(({ c, i }, k) => { const ax = "XYZ"[c.axis], name = `${ax} = ${n(c.at, 2)} mm`;
    return { id: `S${k + 1}`, index: i, region: null, plane: { axis: c.axis, at: c.at, keep: c.keep < 0 ? -1 : 1 }, where: `bloqué perpendiculairement au plan — il tient la place de la moitié retirée`, text: `Symétrie · plan ${name}`, short: `S${k + 1} · symétrie`, color: BC_COLORS.fixed, kind: "symmetry", locked: true, ask: [] }; });
  return bcGroups(st).map((g) => ({ ...g, items: [...(st[g.key] || []).map((x, i) => {
    const id = `${g.tag}${i + 1}`, region = g.key === "fixed" ? supportKey(x) : x.region, off = isOff(x), base = { id, index: i, region, where: labelOf(region), off, ask: off || g.key === "fixed" || !Array.isArray(x.ask) ? [] : x.ask };      // what is off asks for nothing
    if (g.key === "fixed") return { ...base, text: supportText(x), short: supportDofs(x).every(Boolean) ? id : `${id} · ${"XYZ".split("").filter((_, k) => supportDofs(x)[k]).join("")}`, color: g.color, kind: "fixed" };
    if (g.key === "loads") return x.mode === "pressure" ? { ...base, text: `Pression ${n(x.p)} MPa`, short: `${id} · ${n(x.p)} MPa`, color: BC_COLORS.pressure, kind: "pressure" }
      : { ...base, text: `Force ${n(x.F, 1)} N ${dirText(x)}`, short: `${id} · ${n(x.F, 1)} N ${dirText(x, true)}`, color: BC_COLORS.force, kind: "force" };
    if (g.key === "power") return { ...base, text: `Source ${n(x.P, 1)} W`, short: `${id} · ${n(x.P, 1)} W`, color: g.color, kind: "power" };
    return { ...base, text: `Température ${n(x.T, 1)} °C`, short: `${id} · ${n(x.T, 1)} °C`, color: g.color, kind: "fixedT" };
  }), ...(g.key === "fixed" ? sym : [])] }));
}
/** The item a number names : { group, item } — null when it is gone. */
export function bcFind(tree, id) { for (const g of tree) { const it = g.items.find((x) => x.id === id); if (it) return { group: g, item: it }; } return null; }
/** The labels the view shows : a whole type when its switch is on, and always the selected item. */
export function bcLabels(tree, show = {}, selected = null) {
  const out = [];
  for (const g of tree) for (const it of g.items) if ((show[g.key] !== false && !it.off) || it.id === selected) out.push({ ...it, group: g.key, selected: it.id === selected });      // what is off shows only while it is selected
  return out;
}
