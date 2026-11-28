/* DynamiteOrbit.ai — the TABLE of the lab : several boards tested together (point 6, JP, 20 novembre 2026 : « Labo à plusieurs cartes : deux
   vues à bascule — la table (cartes posées, appareils dessinés au-dessus, câbles jusqu'aux points d'entrée et de sortie) et le schéma des
   liaisons, où un lien se change (l'outil refuse l'incompatible) ; deux cartes dont les interfaces s'accordent se relient d'office »).
   A board meets another through its CONNECTORS : each pin of a connector (J…) carries a net of the board, with its class and its voltage —
   that is a PORT. A cable of the bench joins a port of one board to a port of another. What the tool refuses, and says why : a ground on
   a supply, a supply on a signal, two supplies of different voltages, a high voltage on a low-voltage pin, two different buses, the two
   wires of a pair crossed, two pins of the same board. Two boards whose connectors carry the same nets are linked at once (autoLinks) —
   never through a programming header (SWD), which is not a link between boards. Kept in the project (`labTable`) : the boards on the table
   and the cables, each On / Off. Nothing is simulated together here : the table says how the boards are wired, and the guide what does
   not hold. Pure. */

const DEBUG = /^(SWDIO|SWCLK|SWO|RESET_N|NRST|TDI|TDO|TMS|TCK|BOOT0)$/i;
export const PORT_KINDS = {
  power: { fr: "Alimentation", color: "#dc2626" }, ground: { fr: "Masse", color: "#111827" }, signal: { fr: "Signal", color: "#2563eb" }, hv: { fr: "Haute tension", color: "#ea580c" },
};
const norm = (name) => String(name || "").replace(/^\+/, "").toUpperCase();
/** A net's kind, read from its class and its voltage. */
export const kindOf = (net) => (net.class === "ground" || /^(GND|AGND|PGND|0V)/i.test(net.name || "") ? "ground" : net.class === "hv" || (net.class === "power" && (net.voltage || 0) >= 60) ? "hv" : net.class === "power" ? "power" : "signal");
/* a bus and the wire of its pair : RS485_A → { family: RS485, pole: A } ; CAN_H → { CAN, H } */
const pairOf = (name) => { const m = /^(.*?)[_-]?(A|B|H|L|P|N|\+|-)$/i.exec(norm(name)); return m && m[1] ? { family: m[1], pole: m[2] } : { family: norm(name), pole: "" }; };

/** The ports of a board : each pin of a connector on a net. → [{ key: "BOARD:J1.1", board, pin, ref, net, kind, volts, debug }] */
export function portsOf(board) {
  const out = [], conn = new Set((board.parts || []).filter((p) => /^J\d/.test(p.ref || "")).map((p) => p.ref)), debugRefs = new Set();
  for (const n of board.nets || []) if (DEBUG.test(n.name || "")) for (const pin of n.pins || []) debugRefs.add(String(pin).split(".")[0]);
  for (const n of board.nets || []) for (const pin of n.pins || []) { const ref = String(pin).split(".")[0]; if (!conn.has(ref)) continue;
    out.push({ key: `${board.id}:${pin}`, board: board.id, pin, ref, net: n.name, kind: kindOf(n), volts: Number.isFinite(n.voltage) ? n.voltage : null, debug: debugRefs.has(ref) }); }
  return out.sort((a, b) => a.pin.localeCompare(b.pin, "en", { numeric: true }));
}
/** Can a cable join these two ports ? → { ok, why (in words, when not) } */
export function linkCheck(a, b) {
  if (!a || !b) return { ok: false, why: "Une des deux broches n'existe plus sur sa carte." };
  if (a.key === b.key) return { ok: false, why: "Une broche ne se relie pas à elle-même." };
  if (a.board === b.board) return { ok: false, why: "Deux broches d'une même carte : c'est une piste de la carte, pas un câble du banc." };
  if (a.debug || b.debug) return { ok: false, why: `${a.debug ? a.ref : b.ref} est un connecteur de programmation : il se branche à la sonde de débogage, pas à une autre carte.` };
  const K = PORT_KINDS;
  if (a.kind !== b.kind) return { ok: false, why: `${K[a.kind].fr} (${a.net}) sur ${K[b.kind].fr.toLowerCase()} (${b.net}) : ${a.kind === "ground" || b.kind === "ground" ? "une masse ne se relie qu'à une masse" : a.kind === "hv" || b.kind === "hv" ? "une haute tension sur une broche basse tension la détruit" : "une alimentation sur un signal force la broche hors de sa plage"}.` };
  if ((a.kind === "power" || a.kind === "hv") && Number.isFinite(a.volts) && Number.isFinite(b.volts) && Math.abs(a.volts - b.volts) > 0.1 * Math.max(a.volts, b.volts)) return { ok: false, why: `${a.net} (${fmt(a.volts)} V) sur ${b.net} (${fmt(b.volts)} V) : deux tensions différentes — l'une des cartes recevrait une tension qu'elle ne tient pas.` };
  if (a.kind === "signal") { const p = pairOf(a.net), q = pairOf(b.net);
    if (p.family !== q.family && (p.pole || q.pole) && !(norm(a.net) === norm(b.net))) return { ok: false, why: `${a.net} et ${b.net} : deux liaisons différentes (${p.family} et ${q.family}).` };
    if (p.family === q.family && p.pole && q.pole && p.pole !== q.pole) return { ok: false, why: `${a.net} sur ${b.net} : les deux fils de la paire sont croisés — ${p.pole} va sur ${p.pole}.` }; }
  return { ok: true, why: "" };
}
const fmt = (v) => String(+(+v).toPrecision(3)).replace(".", ",");

/** The table as kept : { boards: [ids], links: [{ id, a: port key, b: port key, auto?, on? }] } — what is not whole is dropped. */
export function tableOf(project) {
  const t = (project && project.labTable) || {}, ids = new Set(((project && project.boards) || []).map((b) => b.id));
  return { boards: (Array.isArray(t.boards) ? t.boards : []).filter((x) => typeof x === "string" && ids.has(x)), links: (Array.isArray(t.links) ? t.links : []).filter((l) => l && typeof l.a === "string" && typeof l.b === "string") };
}
const nextId = (links) => { let n = links.length + 1; while (links.some((l) => l.id === `C${n}`)) n++; return `C${n}`; };
const has = (links, a, b) => links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));

/** The cables two boards take at once : the same net on a connector of each, and the check holds ; one ground cable between two boards. → [{ a, b, auto: true }] */
export function autoLinks(A, B) {
  const pa = portsOf(A).filter((p) => !p.debug), pb = portsOf(B).filter((p) => !p.debug), out = [];
  for (const p of pa.filter((x) => x.kind !== "ground")) { const q = pb.find((x) => x.kind !== "ground" && norm(x.net) === norm(p.net)); if (q && linkCheck(p, q).ok && !out.some((l) => l.b === q.key)) out.push({ a: p.key, b: q.key, auto: true }); }
  /* two boards meet through a connector of each : a SIGNAL is linked when its pair of connectors shares two nets or more — a single signal name
     met by chance on two unrelated connectors (an NTC0 of each board) is not, unless it is all the two boards share ; a supply is always linked */
  const pairOfRefs = (l) => `${l.a.split(":")[1].split(".")[0]}>${l.b.split(":")[1].split(".")[0]}`, count = {}; for (const l of out) count[pairOfRefs(l)] = (count[pairOfRefs(l)] || 0) + 1;
  const best = Math.max(0, ...Object.values(count)), kindAt = (k) => (pa.find((x) => x.key === k) || {}).kind;
  if (out.length) out.splice(0, out.length, ...out.filter((l) => kindAt(l.a) !== "signal" || count[pairOfRefs(l)] >= 2 || count[pairOfRefs(l)] === best));
  if (out.length) { const refA = (k) => k.split(":")[1].split(".")[0], ra = refA(out[0].a), rb = refA(out[0].b), g = pa.find((x) => x.kind === "ground" && x.ref === ra) || pa.find((x) => x.kind === "ground"), h = pb.find((x) => x.kind === "ground" && x.ref === rb) || pb.find((x) => x.kind === "ground"); if (g && h) out.push({ a: g.key, b: h.key, auto: true }); }      // the return of the current : one ground, on the connector the others use
  return out;
}
/** A board put on the table (in a step of the store) : it is linked at once to those already there whose connectors match. → the cables added */
export function putBoard(project, boardId) {
  const t = (project.labTable = tableOf(project)), board = (project.boards || []).find((b) => b.id === boardId); if (!board || t.boards.includes(boardId)) return [];
  const added = [];
  for (const id of t.boards) { const other = project.boards.find((b) => b.id === id); if (!other) continue; for (const l of autoLinks(other, board)) if (!has(t.links, l.a, l.b)) { const c = { id: nextId(t.links), ...l }; t.links.push(c); added.push(c); } }
  t.boards.push(boardId); return added;
}
/** A board taken off the table, with its cables. */
export function takeBoard(project, boardId) { const t = (project.labTable = tableOf(project)); t.boards = t.boards.filter((x) => x !== boardId); t.links = t.links.filter((l) => !l.a.startsWith(`${boardId}:`) && !l.b.startsWith(`${boardId}:`)); }
/** The port a key names, on the boards of the project. */
export function portOf(project, key) { const id = String(key).split(":")[0], b = ((project && project.boards) || []).find((x) => x.id === id); return b ? portsOf(b).find((p) => p.key === key) || null : null; }
/** A cable drawn by hand (in a step of the store) : checked first. → { ok, why, link } */
export function addLink(project, a, b) {
  const t = (project.labTable = tableOf(project)), c = linkCheck(portOf(project, a), portOf(project, b)); if (!c.ok) return c;
  if (has(t.links, a, b)) return { ok: false, why: "Ce câble est déjà posé." };
  const link = { id: nextId(t.links), a, b }; t.links.push(link); return { ok: true, why: "", link };
}
export function removeLink(project, id) { const t = (project.labTable = tableOf(project)); t.links = t.links.filter((l) => l.id !== id); }
export function setLinkOn(project, id, on) { const t = (project.labTable = tableOf(project)), l = t.links.find((x) => x.id === id); if (l) { if (on) delete l.on; else l.on = false; } }
/** The cables of the table, each read again against the boards as they are now. → [{ ...link, A, B, ok, why, kind }] */
export function tableLinks(project) { return tableOf(project).links.map((l) => { const A = portOf(project, l.a), B = portOf(project, l.b), c = linkCheck(A, B); return { ...l, A, B, ok: c.ok, why: c.why, kind: (A || B || {}).kind || "signal" }; }); }
/** What the guide says about the table : a cable that no longer holds (a board changed under it), a board alone. → [{ level, text, link? }] */
export function tableIssues(project) {
  const t = tableOf(project), out = [];
  for (const l of tableLinks(project)) if (l.on !== false && !l.ok) out.push({ level: "error", text: `Câble ${l.id} (${l.a} ↔ ${l.b}) : ${l.why}`, link: l.id });
  for (const id of t.boards) if (t.boards.length > 1 && !t.links.some((l) => l.on !== false && (l.a.startsWith(`${id}:`) || l.b.startsWith(`${id}:`)))) out.push({ level: "todo", text: `La carte ${id} est sur la table sans aucun câble : reliez-la, ou retirez-la de la table.` });
  return out;
}
/** Where the lab supply goes on the table : the highest supply of each board, when no cable feeds it (the bench feeds what no other board feeds). → [{ board, port, ground, volts }] */
export function benchFeeds(project) {
  const t = tableOf(project), used = new Set(t.links.filter((l) => l.on !== false).flatMap((l) => [l.a, l.b])), out = [];
  for (const id of t.boards) { const b = project.boards.find((x) => x.id === id), P = portsOf(b).filter((p) => p.kind === "power" && !p.debug); if (!P.length) continue;
    const top = [...P].sort((x, y) => (y.volts || 0) - (x.volts || 0))[0]; if (used.has(top.key)) continue; const gnd = portsOf(b).find((p) => p.kind === "ground" && p.ref === top.ref) || null;
    out.push({ board: id, port: top, ground: gnd, volts: top.volts }); }
  return out;
}
