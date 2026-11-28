/* DynamiteOrbit.ai — the mates of an assembly as a tree, by health : broken first, then to check, then sound. Each mate
   has its number, the two parts it joins and the colour of its state — the same in the tree and on its label in the 3D
   view. The labels of a state show when its eye is open (what is wrong shows by default, what is sound stays quiet) ; the
   selected mate always shows. Pure : the Assembly screen draws the tree, the view takes the same colours. */

export const MATE_COLORS = { broken: "#e5484d", check: "#f59e0b", ok: "#2ec27e" };
export const MATE_GROUPS = [
  { key: "broken", fr: "Rompus", one: "rompu", tip: "L'accouplement ne tient plus : une interface a disparu, ou les deux pièces s'interpénètrent" },
  { key: "check", fr: "À vérifier", one: "à vérifier", tip: "Il tient, mais quelque chose est à regarder : paramètres différents des deux côtés, prise de filet courte…" },
  { key: "ok", fr: "Sains", one: "sain", tip: "Rien à signaler" },
];
/** Is the eye of a state open ? Unless the designer said otherwise : yes for what is wrong, no for what is sound. */
export const mateShown = (show, key) => (show && Object.prototype.hasOwnProperty.call(show, key) ? !!show[key] : key !== "ok");

/** The tree : [{ key, fr, color, tip, items: [{ id, state, color, text, where, notes, a, b, linked }] }] — every state, even empty.
    rows : the health of the joints ([{ id, state, notes }], from joint_health.js) ; nameOf(instanceId) → the name of its part. */
export function mateTree(asm, rows, nameOf = (i) => i) {
  const by = new Map((rows || []).map((r) => [r.id, r]));
  const items = ((asm && asm.mates) || []).map((m) => { const h = by.get(m.id) || { state: "ok", notes: [] }, state = MATE_COLORS[h.state] ? h.state : "ok";
    return { id: m.id, state, color: MATE_COLORS[state], text: `${nameOf(m.a.inst)} ↔ ${nameOf(m.b.inst)}`, where: `${m.a.iface} ↔ ${m.b.iface}`, notes: h.notes || [], a: m.a, b: m.b, linked: m.linked !== false }; });
  return MATE_GROUPS.map((g) => ({ ...g, color: MATE_COLORS[g.key], items: items.filter((x) => x.state === g.key) }));
}
/** The mate a number names, or null. */
export function mateFind(tree, id) { for (const g of tree) { const it = g.items.find((x) => x.id === id); if (it) return it; } return null; }
/** The labels the view shows : a state whose eye is open, and always the selected mate. */
export function mateLabels(tree, show, selected = null) {
  const out = [];
  for (const g of tree) for (const it of g.items) if (mateShown(show, g.key) || it.id === selected) out.push({ ...it, selected: it.id === selected });
  return out;
}
