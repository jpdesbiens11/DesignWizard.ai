/* DesignWizard.ai — the names of the trade for a board (demande de JP : « certains de mes collègues appellent PCB la plaque
   verte de FR4 avec ses pistes, et le PCBA devient le "PCB" + "A = Assembly"… rester alignés sur la nomenclature de
   l'industrie… une bascule pour changer les noms partout »).
   The platform says « PCB » for the bare board and « PCBA » for the assembled one : the common usage. Other houses say it
   otherwise — aerospace and defence often write PWB (printed wiring board) and CCA (circuit card assembly), older documents
   PWA (printed wiring assembly). The choice is kept in this browser, like the units, and ONE function maps every text :
   nameBoards(text). The screens are mapped as they are drawn (core/board_names_ui.js, installed once : a screen declares
   nothing) ; the Word and PDF documents are mapped as they are written. What is not mapped, on purpose : identifiers
   (DRV-CTRL-PCBA), file names, the `.dwiz` and the JSON of an artefact, the manufacturing files — data, not words.
   What was read : pages of board makers, which agree on PCB / PCBA and on PWB, PWA and CCA ; the terminology standard itself
   (IPC-T-50) was not read, and « ECB / ECBA » was found nowhere as an established term — a house that uses its own words
   types them (« Vos mots »). Pure, except for the choice kept in the browser. */

/** The sets of names. bare : the board without its parts ; assy : the board with them. */
export const BOARD_NAME_SETS = {
  pcb: { label: "PCB · PCBA", bare: "PCB", assy: "PCBA", hint: "L'usage courant : PCB (printed circuit board) pour la carte nue, PCBA (printed circuit board assembly) pour la carte assemblée." },
  cca: { label: "PWB · CCA", bare: "PWB", assy: "CCA", hint: "Usage fréquent en aérospatiale et en défense : PWB (printed wiring board) pour la carte nue, CCA (circuit card assembly) pour la carte assemblée." },
  pwa: { label: "PWB · PWA", bare: "PWB", assy: "PWA", hint: "Termes plus anciens : PWB (printed wiring board) et PWA (printed wiring assembly)." },
  own: { label: "Vos mots", bare: "", assy: "", hint: "Les deux mots de votre maison, tapés ci-dessous : ils remplacent PCB et PCBA partout." },
};
const WORD = /^[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 .'’/-]{0,23}$/, TOKEN = /(?<![\w-])(PCBA|PCB)(?![\w-])/g;
/** A word a house may give to a board : short, plain, and never one that holds « PCB » or « PCBA » as a word of its own unless it is that very word. */
export const goodBoardWord = (w, self) => typeof w === "string" && WORD.test(w.trim()) && (w.trim() === self || !/(?<![\w-])PCBA?(?![\w-])/.test(w.trim()));
/** The names in force, tidied : → { set, bare, assy, plain (true : nothing to map) } */
export function tidyBoardNames(p) {
  const set = p && BOARD_NAME_SETS[p.set] ? p.set : "pcb", s = BOARD_NAME_SETS[set];
  if (set !== "own") return { set, bare: s.bare, assy: s.assy, plain: set === "pcb" };
  const bare = goodBoardWord(p.bare, "PCB") ? p.bare.trim() : "PCB", assy = goodBoardWord(p.assy, "PCBA") ? p.assy.trim() : "PCBA";
  return { set, bare, assy, plain: bare === "PCB" && assy === "PCBA" };
}
/** A text with the names of the house : « PCBA » and « PCB » as words of their own, never inside an identifier or a file name. */
export function nameBoards(text, names = getBoardNames()) {
  if (typeof text !== "string" || names.plain || text.indexOf("PCB") < 0 || text.startsWith("data:") || (text.length > 512 && !/\s/.test(text))) return text;      // an image or a blob of bytes written as text is not words
  return text.replace(TOKEN, (m) => (m === "PCBA" ? names.assy : names.bare));
}
/** Every text of a document model, mapped — a model of core/pdfdoc.js or core/docx.js ; bytes and numbers are left as they are. */
export function nameBoardsDeep(v, names = getBoardNames()) {
  if (names.plain) return v;
  if (typeof v === "string") return nameBoards(v, names);
  if (Array.isArray(v)) return v.map((x) => nameBoardsDeep(x, names));
  if (v && typeof v === "object" && (v.constructor === Object || v.constructor === undefined)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, nameBoardsDeep(x, names)]));
  return v;
}

/* ---------- the choice, kept in this browser ---------- */
const KEY = "dw.boardNames";
let memo = null;
/** The names in force. Without a browser (tests, tools) : PCB · PCBA. */
export function getBoardNames() {
  if (memo) return memo;
  let p = null;
  try { p = typeof localStorage !== "undefined" ? JSON.parse(localStorage.getItem(KEY) || "null") : null; } catch (e) { p = null; }
  memo = tidyBoardNames(p); return memo;
}
/** Changes the names and tells the screens (« dw:boardNames » on the window). → the names in force */
export function setBoardNames(patch) {
  const cur = getBoardNames(), raw = { set: cur.set, bare: cur.bare, assy: cur.assy, ...patch };
  memo = tidyBoardNames(raw);
  try { if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify({ set: memo.set, bare: memo.bare, assy: memo.assy })); } catch (e) { /* private window : the choice lasts for this page only */ }
  if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") window.dispatchEvent(new CustomEvent("dw:boardNames", { detail: memo }));
  return memo;
}
