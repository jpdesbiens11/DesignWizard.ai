/* DynamiteOrbit.ai — the ROWS of the tree of the history, as they are drawn (JP, 28 novembre 2026, on a capture of a tree of 8 points whose
   titles the right pane cut and whose every row said « branche « … » · Point posé · DynamiteOrbit.ai » ; by menu : « Plus récent en haut,
   bascule » and « Titres complets, branche une fois »).
   What it follows : the history of a version-control client (GitHub Desktop, Sourcetree, GitKraken) — the newest commit on top, the order
   switchable ; a commit's message whole ; the name of a branch said once, at the head of its run of commits, not on every line.
   A row says its title whole, cut into lines at the words (at most three ; the rest in the tooltip) ; the name of its branch when it starts a
   run of rows of the same branch ; under it the date, then the kind when it is not a point posed by hand, the author, the MVP iteration and
   « ajouté de la démonstration » only when they change from the row above. Rows are as tall as what they say. Pure : no page ; measure(text) gives the width of a text. */

import { POINT_KINDS } from "./history.js";
import { branchLayout } from "./history_branches.js";

export const ROW_GEOM = { pill: 22, line: 18, sub: 17, top: 8, bottom: 12 };
const charWidth = (s) => String(s).length * 7.4;

/** A text cut into lines no wider than `width`, at the words ; at most `max` lines, the last one ending in « … » when the text goes on. */
export function wrapText(text, width, measure = charWidth, max = 3) {
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean), lines = [];
  let cur = "";
  for (const w of words) { const next = cur ? `${cur} ${w}` : w; if (cur && measure(next) > width) { lines.push(cur); cur = w; } else cur = next; }
  if (cur) lines.push(cur);
  if (lines.length <= max) return lines.length ? lines : [""];
  const keep = lines.slice(0, max); let last = keep[max - 1];
  while (last.includes(" ") && measure(`${last} …`) > width) last = last.slice(0, last.lastIndexOf(" "));
  keep[max - 1] = `${last} …`; return keep;
}

/** The rows of the tree, top to bottom. o : { newest (true : the newest on top — the default), width (of the text, px), idWidth(id) (px),
    measure(text), when(iso) (the date in words), hereWidth (px : what « ◀ vous êtes ici » takes after a title), pending (the number of artefacts changed since « ici » : a row « Maintenant » at the newest end) }
    → { rows: [{ id, branch, col, parent, merged, head (starts a run), lines, sub: [..], top, dotY, pillY, lineY: [..], subY, h }], height, cols, main, lanes } */
export function treeRows(h, o = {}) {
  const G = branchLayout(h), pts = new Map(((h && h.points) || []).map((p) => [p.id, p])), measure = o.measure || charWidth, width = o.width || 520;
  const newest = o.newest !== false, when = o.when || ((iso) => String(iso || "").slice(0, 16).replace("T", " ")), idW = o.idWidth || ((id) => measure(`${id}  `));
  const order = newest ? G.rows.slice().reverse() : G.rows.slice(), many = G.lanes.length > 1, g = ROW_GEOM, rows = [];
  let y = 0, prev = null;
  const nowRow = () => { const top = y, dotY = top + g.top + 9; rows.push({ id: null, now: true, top, dotY, lineY: [dotY + 4], subY: dotY + 4 + g.sub, h: g.top + 9 + 4 + g.sub + g.bottom }); y += rows.at(-1).h; };
  if (o.pending && newest) nowRow();
  for (const r of order) {
    const p = pts.get(r.id), K = POINT_KINDS[p.kind] || POINT_KINDS.manual, mvp = p.context && p.context.mvp ? p.context.mvp.name : "", head = many && (!prev || prev.branch !== r.branch);
    const lines = wrapText(p.label, width - idW(p.id) - (p.id === h.head ? (o.hereWidth || 0) : 0), measure);      // « ◀ vous êtes ici » ends the title of its row : room is kept for it
    const sub = [when(p.at), p.kind && p.kind !== "manual" ? K.label : "", p.by && (!prev || prev.by !== p.by) ? p.by : "", mvp && (!prev || prev.mvp !== mvp) ? mvp : "", p.demo && (!prev || !prev.demo) ? "ajouté de la démonstration" : ""].filter(Boolean);
    const top = y, pillY = head ? top + g.top + g.pill / 2 - 1 : null, labelTop = top + g.top + (head ? g.pill : 0), lineY = lines.map((_, i) => labelTop + 13 + i * g.line), subY = lineY.at(-1) + g.sub;
    const row = { ...r, head, lines, sub, top, dotY: labelTop + 8, pillY, lineY, subY, h: subY - top + g.bottom };
    rows.push(row); y += row.h; prev = { branch: r.branch, by: p.by || "", mvp, demo: !!p.demo };
  }
  if (o.pending && !newest) nowRow();
  return { rows, height: y, cols: G.cols, main: G.main, lanes: G.lanes };
}
