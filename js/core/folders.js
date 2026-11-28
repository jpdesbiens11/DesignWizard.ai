/* DynamiteOrbit.ai — folders in a list (demande de JP : « prendre plusieurs caractéristiques, plusieurs pièces d'assemblage…
   les regrouper avec un item qui peut les folder ou les défolder, pour montrer le détail ou montrer la vue globale »).
   A folder RANGES, it changes nothing : it is a name carried by the entries it holds (`folder`), and nothing else — no
   operation is moved, no part is re-mounted, no revision is touched (the signature of an artefact ignores it : core/review.js).
   It is not « Grouper », which forms a sub-assembly and does change the structure of the product.
   The usage it follows : the feature folders of the mechanical modellers.
   Two kinds of list :
     - an ORDERED list (the operations of a part : the order is the order of construction) — a folder shows each RUN of
       consecutive entries that carry its name, so what one reads stays the order in which the part is built ;
     - a list whose order means nothing (the elements of an assembly) — a folder gathers all its entries where its first one is.
   Pure : no page. The folded state is a state of the view, kept in the browser by the two functions at the end. */

export const folderOf = (x) => (x && typeof x.folder === "string" ? x.folder.trim() : "");
/** The names of the folders of a list, in the order they first appear. */
export const folderNames = (items) => [...new Set((items || []).map(folderOf).filter(Boolean))];
/** A name no folder of the list has yet : « Dossier 1 », « Dossier 2 »… */
export function nextFolderName(items, base = "Dossier") { const have = new Set(folderNames(items)); let n = 1; while (have.has(`${base} ${n}`)) n++; return `${base} ${n}`; }

/** The rows of a list with its folders. items : the entries, in their order ; o.runs : true for an ordered list (see above).
    → [{ kind: "item", item, index } | { kind: "folder", name, key (unique in the list : a name, or name#2 for its second run), rows: [{ item, index }] }] */
export function folderRows(items, o = {}) {
  const out = [], seen = new Map(), list = items || [];
  for (let i = 0; i < list.length; i++) {
    const name = folderOf(list[i]);
    if (!name) { out.push({ kind: "item", item: list[i], index: i }); continue; }
    const last = out[out.length - 1];
    if (o.runs) {
      if (last && last.kind === "folder" && last.name === name) { last.rows.push({ item: list[i], index: i }); continue; }
      const n = (seen.get(name) || 0) + 1; seen.set(name, n);
      out.push({ kind: "folder", name, key: n > 1 ? `${name}#${n}` : name, rows: [{ item: list[i], index: i }] });
    } else {
      let f = seen.get(name); if (!f) { f = { kind: "folder", name, key: name, rows: [] }; seen.set(name, f); out.push(f); }
      f.rows.push({ item: list[i], index: i });
    }
  }
  return out;
}
const clean = (name) => String(name || "").replace(/\s+/g, " ").trim().slice(0, 48);
/** Put the entries chosen in a folder. pick(item, index) → true for an entry chosen. → a new list ; an empty name takes them out. */
export function setFolder(items, pick, name) {
  const n = clean(name);
  return (items || []).map((x, i) => { if (!pick(x, i)) return x; const y = { ...x }; if (n) y.folder = n; else delete y.folder; return y; });
}
/** Rename a folder — every entry that carries the name. Renaming to the name of another folder merges them. */
export const renameFolder = (items, from, to) => (clean(to) && clean(to) !== from ? setFolder(items, (x) => folderOf(x) === from, to) : items || []);
/** Undo a folder : its entries stay where they are, as they are ; only the name goes. */
export const dropFolder = (items, name) => setFolder(items, (x) => folderOf(x) === name, "");
/** How a folder stands, for its line : how many entries, how many set aside (`offKey`), hidden (`hideKey`). */
export function folderState(rows, o = {}) {
  const n = rows.length, off = o.offKey ? rows.filter((r) => r.item[o.offKey]).length : 0, hidden = o.hideKey ? rows.filter((r) => r.item[o.hideKey]).length : 0;
  return { n, off, hidden, allOff: n > 0 && off === n, allHidden: n > 0 && hidden === n, note: `${n}${off ? ` · ${off} à Off` : ""}${hidden ? ` · ${hidden} masqué${hidden > 1 ? "s" : ""}` : ""}` };
}

/* ---- the folded state : a state of the view, per list (scope) and folder, kept in the browser ---- */
const SLOT = "dwiz.folded";
const read = (storage) => { try { const v = JSON.parse((storage && storage.getItem(SLOT)) || "{}"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch { return {}; } };
export const isFolded = (scope, key, storage = globalThis.localStorage) => !!read(storage)[`${scope}|${key}`];
export function setFolded(scope, key, on, storage = globalThis.localStorage) { const v = read(storage); if (on) v[`${scope}|${key}`] = 1; else delete v[`${scope}|${key}`]; try { if (storage) storage.setItem(SLOT, JSON.stringify(v)); } catch { /* a private window : the state lives for the page only */ } return !!on; }
