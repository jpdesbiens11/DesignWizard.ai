/* DesignWizard.ai — PCBA: everything a design review reads, gathered from the board in one call — the functional
   structure, the blocks with their sizing, the checks, the routing figures, the fabrication package. */

import { resolveBoard, boardBom, libraryOf } from "./model.js";
import { BLOCKS, buildBlock, blockSentence } from "./blocks.js";
import { functionRows } from "./synth.js";
import { erc } from "./erc.js";
import { checkBoard } from "./drc.js";
import { zoneProblems, placementProblems } from "./place.js";
import { routeStats } from "./route.js";
import { fabPackage, stackup } from "./fabfiles.js";
import { coatingKeepouts } from "./art.js";

/** opts : { kind: "PDR" | "CDR", author, date, project: { id, name }, figures, open, decisions }. */
export function reviewData(board, lib, opts = {}) {
  const L = libraryOf(board, lib), R = resolveBoard(board, lib), kind = opts.kind || "PDR", date = opts.date || new Date(0), review = board.review || {};
  const blocks = (board.blocks || []).map((b) => { const t = BLOCKS[b.template], built = t ? buildBlock(b.template, b.params) : { calc: [], notes: [] }, parts = (board.parts || []).filter((p) => p.block === b.id);
    return { id: b.id, name: b.name, templateName: t ? t.name : b.template, function: t ? blockSentence(t, b.params) : "", params: b.params, calc: built.calc, notes: built.notes, parts: parts.map((p) => p.ref), cost: parts.reduce((s, p) => s + ((L[p.comp] && L[p.comp].price) || 0), 0) }; });
  const fab = kind === "CDR" ? fabPackage(board, lib, { date }) : null;
  return { kind, project: opts.project || {}, board, author: opts.author ?? review.author ?? "", date, resolved: R, bom: boardBom(board, lib), tree: functionRows(board, lib), blocks, erc: erc(board, lib), drc: checkBoard(board, lib),
    zones: zoneProblems(board, lib), placement: placementProblems(board, lib), route: routeStats(board, lib), fab: fab ? { files: fab.files.map((f) => ({ name: f.name, label: f.label })), stats: fab.stats, notes: fab.notes } : null,
    coatingKeepouts: coatingKeepouts(R, board), stack: stackup(board), figures: opts.figures || {}, open: opts.open ?? review.open ?? [], decisions: opts.decisions ?? review.decisions ?? [] };
}
