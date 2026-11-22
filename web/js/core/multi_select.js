/* DesignOrbit.ai — choosing several lines of a list at once (demande de JP : « la fonction contrôle doit permettre de faire
   des multiples sélections »). The usage it follows is the one of every file manager and list box : a click takes one line ;
   Ctrl (⌘ on a Mac) + click adds a line or takes it away ; Shift + click takes the whole run from the last line clicked.
   What is chosen is kept in the order of the list. Pure : a screen gives the list, the line and the keys, and gets the choice. */

/** The keys held during a click. */
export const modsOf = (e) => ({ ctrl: !!(e && e.ctrlKey), meta: !!(e && e.metaKey), shift: !!(e && e.shiftKey) });
/** Is this click one that builds a choice of several lines ? */
export const isMulti = (e) => !!(e && (e.ctrlKey || e.metaKey || e.shiftKey));

/** One click on a list. sel : the lines chosen so far ; order : every line of the list, top to bottom ; id : the line clicked ;
    mods : modsOf(event) ; anchor : the line the last click left as the start of a run. → { ids (in the order of the list), anchor } */
export function pickStep(sel, order, id, mods = {}, anchor = null) {
  if (!order.includes(id)) return { ids: (sel || []).filter((x) => order.includes(x)), anchor };
  const cur = (sel || []).filter((x) => order.includes(x)), add = !!(mods.ctrl || mods.meta);
  if (mods.shift) {      // the run from where the last click was to here ; with Ctrl it is added to what was chosen
    const from = order.indexOf(anchor !== null && order.includes(anchor) ? anchor : cur.length ? cur[cur.length - 1] : id), to = order.indexOf(id), run = order.slice(Math.min(from, to), Math.max(from, to) + 1);
    return { ids: add ? order.filter((x) => cur.includes(x) || run.includes(x)) : run, anchor: order[from] };
  }
  if (add) return { ids: cur.includes(id) ? cur.filter((x) => x !== id) : order.filter((x) => x === id || cur.includes(x)), anchor: id };
  return { ids: [id], anchor: id };
}
/** What is left of a choice when the list changed : the lines that are still there. */
export const keepChosen = (sel, order) => (sel || []).filter((x) => order.includes(x));
/** « 3 pièces choisies » : the count, with its word. */
export const chosenWords = (n, one, many, f = false) => `${n} ${n > 1 ? many : one} choisi${f ? "e" : ""}${n > 1 ? "s" : ""}`;
