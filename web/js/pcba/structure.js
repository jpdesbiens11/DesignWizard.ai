/* DynamiteOrbit.ai — PCBA: the functional structure of a board, the way a functional analysis draws it : what enters
   the system on the left, what leaves it on the right, the blocks in between, and the flows that join them —
   energy (supply nets) and information (signal nets). It is read from the board itself : a block is a sub-system,
   a connector is the boundary, a net shared by two blocks is a flow, from the pin that drives it to the pins that
   listen. And the function tree as a diagram : to the right « how ? », to the left « why ? », downwards « when ? ».
   Both come out as editable draw.io pages (core/drawio.js) and as a table. */

import { resolveBoard } from "./model.js";
import { BLOCKS, BLOCK_CATEGORIES, buildBlock } from "./blocks.js";
import { BOX, LINK } from "../core/drawio.js";

const OUT = new Set(["power_out", "out"]), EDGE = new Set(["Raccorder"]);

/** → { name, blocks: [{ id, name, category, external, side: "in" | "out" | null }], flows: [{ from, to, kind: "énergie" | "information", nets: [names] }] } */
export function functionalStructure(board, lib) {
  const R = resolveBoard(board, lib), blockOf = new Map((board.parts || []).map((p) => [p.ref, p.block || null])), cat = (b) => (BLOCKS[b.template] ? BLOCKS[b.template].category : "Autre");
  const blocks = (board.blocks || []).map((b) => ({ id: b.id, name: b.name || (BLOCKS[b.template] || {}).name || b.template, category: cat(b), external: EDGE.has(cat(b)) || b.template === "conn_swd", side: null })), ext = new Set(blocks.filter((b) => b.external).map((b) => b.id)), flows = new Map();
  // which nets a block drives : what its template declares as an output (a regulator drives its rail through an inductor, a passive part)
  const drives = new Map();
  for (const b of board.blocks || []) { const set = new Set(); try { for (const [name, port] of Object.entries(buildBlock(b.template, b.params).ports)) if (OUT.has(port.dir)) set.add(port.lazy ? port.suggest : (b.connect || {})[name] || port.suggest); } catch (e) { /* unknown template : its pins will tell */ } drives.set(b.id, set); }
  for (const net of R.nets) {
    if (net.class === "ground") continue;
    const on = new Map();                                         // block → does it drive the net
    for (const i of net.pads) { const p = R.pads[i], b = blockOf.get(p.ref); if (!b) continue; on.set(b, (on.get(b) || false) || OUT.has(p.type) || (drives.get(b) || new Set()).has(net.name)); }
    if (on.size < 2) continue;
    const ids = [...on.keys()], kind = net.class === "signal" ? "information" : "énergie", drivers = ids.filter((b) => on.get(b));
    const from = drivers.find((b) => !ext.has(b)) || drivers[0] || ids.find((b) => ext.has(b)) || ids[0];      // the pin that drives ; failing that what comes from outside
    for (const to of ids) { if (to === from) continue; const key = `${from}|${to}|${kind}`; if (!flows.has(key)) flows.set(key, { from, to, kind, nets: [] }); flows.get(key).nets.push(net.name); }
  }
  const list = [...flows.values()];
  for (const b of blocks) if (b.external) { const gives = list.filter((f) => f.from === b.id).length, takes = list.filter((f) => f.to === b.id).length; b.side = gives >= takes ? "in" : "out"; }
  return { name: `${board.id} — ${board.name || ""}`.trim(), blocks, flows: list };
}

const csv = (v) => (/[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
/** The flows as a table for a spreadsheet. */
export function structureCsv(S) {
  const name = new Map(S.blocks.map((b) => [b.id, b.name]));
  return `﻿${[["De", "Bloc", "Vers", "Bloc", "Flux", "Nets"], ...S.flows.map((f) => [f.from, name.get(f.from) || "", f.to, name.get(f.to) || "", f.kind, f.nets.join(" ")])].map((l) => l.map(csv).join(";")).join("\r\n")}\r\n`;
}

const FLOW = { "énergie": `${LINK}strokeWidth=3;strokeColor=#C2410C;fontColor=#9A3412;`, information: `${LINK}strokeWidth=1;dashed=1;strokeColor=#1D4ED8;fontColor=#1E3A8A;` };
/** The boundary diagram as a draw.io page. */
export function structureDiagram(S) {
  const nodes = [], bw = 170, bh = 56, gy = 26, ins = S.blocks.filter((b) => b.side === "in"), outs = S.blocks.filter((b) => b.side === "out"), mid = S.blocks.filter((b) => !b.external).sort((a, c) => BLOCK_CATEGORIES.indexOf(a.category) - BLOCK_CATEGORIES.indexOf(c.category));
  const cols = Math.max(1, Math.min(3, Math.ceil(mid.length / 5))), rows = Math.ceil(mid.length / cols), x0 = 40, xs = x0 + bw + 130, top = 90, height = Math.max(rows, ins.length, outs.length, 1) * (bh + gy) + 40, width = cols * (bw + 90) + 20;
  nodes.push({ id: "titre", x: x0, y: 20, w: 620, h: 40, text: `Structure fonctionnelle — ${S.name}\nÀ gauche ce qui entre, à droite ce qui sort ; trait épais : énergie, pointillé : information.`, style: "text;html=1;align=left;verticalAlign=top;fontSize=12;fontStyle=1;" });
  nodes.push({ id: "systeme", x: xs - 30, y: top - 30, w: width + 40, h: height + 30, text: "Système", style: "rounded=1;dashed=1;fillColor=none;strokeColor=#64748B;verticalAlign=top;align=left;spacingLeft=8;html=1;fontSize=11;fontColor=#475569;" });
  mid.forEach((b, i) => nodes.push({ id: b.id, x: xs + (i % cols) * (bw + 90), y: top + Math.floor(i / cols) * (bh + gy), w: bw, h: bh, text: `${b.id} · ${b.category}\n${b.name}`, style: `${BOX}fillColor=#EFF6FF;strokeColor=#1D4ED8;` }));
  ins.forEach((b, i) => nodes.push({ id: b.id, x: x0, y: top + i * (bh + gy), w: bw, h: bh, text: `${b.id} · entrée\n${b.name}`, style: `${BOX}fillColor=#FEF3C7;strokeColor=#B45309;` }));
  outs.forEach((b, i) => nodes.push({ id: b.id, x: xs + width + 80, y: top + i * (bh + gy), w: bw, h: bh, text: `${b.id} · sortie\n${b.name}`, style: `${BOX}fillColor=#DCFCE7;strokeColor=#15803D;` }));
  return { name: "Structure fonctionnelle", nodes, edges: S.flows.map((f) => ({ from: f.from, to: f.to, text: f.nets.length > 3 ? `${f.nets.slice(0, 3).join(", ")} +${f.nets.length - 3}` : f.nets.join(", "), style: FLOW[f.kind] })) };
}

const KIND = { principale: `${BOX}fillColor=#DBEAFE;strokeColor=#1D4ED8;fontStyle=1;`, contrainte: `${BOX}fillColor=#F1F5F9;strokeColor=#64748B;dashed=1;`, technique: `${BOX}fillColor=#FFFFFF;strokeColor=#334155;` };
/** The function tree as a draw.io page. rows : functionRows(board). The functions that wait for a human (« Brouillon IA ») are marked. */
export function treeDiagram(rows, name = "", drafts = new Set()) {
  const nodes = [], edges = [], bw = 190, bh = 54, gx = 60, gy = 16, y = new Map(); let slot = 0;
  const place = (r) => { const kids = rows.filter((k) => k.parent === r.id); if (!kids.length) { y.set(r.id, slot++); return; } kids.forEach(place); y.set(r.id, (y.get(kids[0].id) + y.get(kids[kids.length - 1].id)) / 2); };
  rows.filter((r) => !r.parent).forEach(place);
  nodes.push({ id: "titre", x: 40, y: 20, w: 720, h: 40, text: `Arbre des fonctions — ${name}\nVers la droite : comment ? · vers la gauche : pourquoi ? · de haut en bas : quand ?`, style: "text;html=1;align=left;verticalAlign=top;fontSize=12;fontStyle=1;" });
  for (const r of rows) {
    const x = 40 + (r.level - 1) * (bw + gx), top = 80 + y.get(r.id) * (bh + gy), lost = r.leaf && !r.block && r.kind !== "contrainte", crit = (r.criteria || []).map((c) => `${c.name} : ${c.level} (${c.flex || "F1"})`).slice(0, 2).join("\n");
    nodes.push({ id: r.id, x, y: top, w: bw, h: bh, text: `${r.id}${drafts.has(r.id) ? " · brouillon IA" : ""}\n${r.name}${crit ? `\n${crit}` : ""}`, style: `${KIND[r.kind] || KIND.technique}${lost ? "strokeColor=#DC2626;strokeWidth=2;" : ""}${drafts.has(r.id) ? "fillColor=#FEF9C3;" : ""}` });
    if (r.parent) edges.push({ from: r.parent, to: r.id });
    if (r.block) { nodes.push({ id: `s_${r.id}`, x: x + bw + gx, y: top, w: bw, h: bh, text: `${r.block} · ${r.templateName || r.blockName}\n${r.parts.length} composant(s)`, style: `${BOX}fillColor=#DCFCE7;strokeColor=#15803D;` }); edges.push({ from: r.id, to: `s_${r.id}` }); }
    else if (lost) { nodes.push({ id: `s_${r.id}`, x: x + bw + gx, y: top, w: bw, h: bh, text: "sans solution", style: `${BOX}fillColor=#FEE2E2;strokeColor=#DC2626;dashed=1;` }); edges.push({ from: r.id, to: `s_${r.id}` }); }
  }
  return { name: "Arbre des fonctions", nodes, edges };
}
