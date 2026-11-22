/* DynamiteOrbit — Labo, the breadboard (JP, 22 novembre 2026, on a capture of the Labo : « une vue breadboard plus clean… voir
   clairement ce qui se connecte où sur la carte en laissant sortir les traces vers le breadboard de manière clean et en connectant
   les instruments sur les pins du breadboard bien identifiés par tag de carte et d'équipement »).
   Each point of the board an instrument touches is brought out, by its own jumper, to its own row of a breadboard set beside the
   board ; the row is tagged with the board's name of the point (reference . pin) and its signal ; the leads of the instruments go
   into the holes of that row, each tagged with its instrument. The usage followed : the breadboard view of the prototyping tools
   (a row of five holes tied together, one jumper per connection) and the escape of a routed trace — straight out of the board, one
   lane per trace, turned once toward its row. No two jumpers cross : the rows keep the order of their points, and the lanes are
   ordered by the way each trace turns (a trace that climbs further right the lower it starts, one that goes down further right the
   higher it starts). Pads on one line : the one furthest right goes straight, each one left of it steps up a little first. What is
   done ON the board — a finger on a button, the cell in its holder — stays on the board. Pure : no page. Millimetres of the board,
   y up. */

/** What stays on the board : what the hand does there, not a lead one plugs. */
const ON_BOARD = new Set(["press", "cell"]);
/** The tag of an instrument on the breadboard, short : the kind of its key (« supply:VIN » → « Alim. »). */
export const GEAR_TAG = { supply: "Alim.", load: "Charge", wire: "Comp.", generator: "Gén.", logic: "Bus", scope: "Osc.", meter: "Multi.", press: "Doigt", cell: "Pile" };
const GROUND = /^(GND|0|AGND|PGND|DGND|VSS|GND_?ISO|ISO_?GND|B-|BAT-)$/i;
/** The kind of an instrument from its key (pcba/lab_gear.js gearKey). */
export const kindOf = (gear) => String(gear || "").split(":")[0];
/** The tag of one lead : its instrument and the letter of the lead (« Alim. + », « Osc. S »). */
export const leadTag = (p) => `${GEAR_TAG[kindOf(p.gear)] || "Appareil"} ${p.label || ""}`.trim();
/* a jumper takes the colour of what it carries : the ground black, the + of a supply red, the others each their own */
const HUES = ["#2563eb", "#d97706", "#059669", "#db2777", "#7c3aed", "#0891b2", "#65a30d", "#b45309"];

/** The breadboard of a test. points : the points of the instruments, placed on the board (pcba/lab_manip.js placedPoints().points,
    each with its `gear`) ; bbox : the board [x0, y0, x1, y1] ; o : { board (its name, written on the breadboard) }.
    → { rows: [{ key, ref, pin, signal, ground, color, at: {x,y}, y, holes: [[x,y]], leads: [{ ...point, hole: [x,y], tag }] }],
        jumpers: [{ key, color, pts: [[x,y]] }], box: [x0,y0,x1,y1] | null, stay: [points left on the board], pitch, hole,
        cols: { tag (x of the row tags), holes (x of the first hole), gear (x of the instrument tags) }, title } */
export function breadLayout(points, bbox, o = {}) {
  const all = (points || []).filter((p) => p && p.at), on = all.filter((p) => p.gear && !ON_BOARD.has(kindOf(p.gear))), stay = all.filter((p) => !on.includes(p));
  if (!on.length || !bbox) return { rows: [], jumpers: [], box: null, stay: all, pitch: 0, hole: 0, cols: null, title: "" };
  const [, y0, x1, y1] = bbox, S = Math.max(bbox[2] - bbox[0], y1 - y0, 20), P = S / 9, hole = P * 0.62, lane = P * 0.34, jog = Math.min(0.8, P * 0.12), font = P * 0.36;
  /* one row per pad : the leads that go to the same pad share its row */
  const byPad = new Map();
  for (const p of on) { const k = `${p.ref}.${p.pin}`; if (!byPad.has(k)) byPad.set(k, { key: k, ref: p.ref, pin: String(p.pin), signal: p.signal || "", at: { x: p.at.x, y: p.at.y }, leads: [] });
    const r = byPad.get(k); if (!r.leads.some((l) => l.gear === p.gear && l.lead === p.lead)) r.leads.push(p); if (!r.signal && p.signal) r.signal = p.signal; }
  const rows = [...byPad.values()];
  /* pads on one line : the left ones step up first — never as high as the next pad above, so that the order of the rows holds */
  for (const r of rows) { const line = rows.filter((q) => Math.abs(q.at.y - r.at.y) < 0.05), above = Math.min(...rows.filter((q) => q.at.y >= r.at.y + 0.05).map((q) => q.at.y - r.at.y)), step = Math.min(jog, above / (line.length + 1));
    r.ey = r.at.y + line.filter((q) => q !== r && q.at.x > r.at.x + 1e-6).length * step; }
  rows.sort((a, b) => b.ey - a.ey || b.at.x - a.at.x);
  const n = rows.length, cy = (y0 + y1) / 2;
  let hue = 0; rows.forEach((r, k) => { r.y = cy + ((n - 1) / 2 - k) * P; r.ground = GROUND.test(r.signal) || r.leads.every((l) => ["minus", "black", "clip", "back"].includes(l.lead));
    r.color = r.ground ? "#1f2937" : r.leads.some((l) => l.lead === "plus") ? "#dc2626" : HUES[hue++ % HUES.length]; });
  /* the lanes, left to right : those that climb (the higher start first), those that stay level, those that go down (the lower start first) */
  const up = rows.filter((r) => r.y > r.ey + 1e-9).sort((a, b) => b.ey - a.ey), flat = rows.filter((r) => Math.abs(r.y - r.ey) <= 1e-9), down = rows.filter((r) => r.y < r.ey - 1e-9).sort((a, b) => a.ey - b.ey);
  const lx0 = x1 + P * 0.8; [...up, ...flat, ...down].forEach((r, i) => { r.lane = lx0 + i * lane; });
  /* the breadboard : the tags of the rows, the holes, the tags of the instruments */
  const wide = (s) => s.length * font * 0.58, bx = lx0 + (n - 1) * lane + P * 0.9, tagW = Math.max(...rows.map((r) => wide(`${r.key} · ${r.signal}`))) + P * 0.5, hx = bx + tagW;
  const holesOf = (r) => Math.max(5, r.leads.length + 1), last = Math.max(...rows.map(holesOf)), gx = hx + (last - 1) * hole + hole * 0.9;
  const out = rows.map((r) => { const holes = Array.from({ length: holesOf(r) }, (_, i) => [hx + i * hole, r.y]);
    return { key: r.key, ref: r.ref, pin: r.pin, signal: r.signal, ground: r.ground, color: r.color, at: r.at, y: r.y, holes, leads: r.leads.map((l, i) => ({ ...l, hole: holes[i + 1], tag: leadTag(l) })) }; });
  const jumpers = rows.map((r) => ({ key: r.key, color: r.color, pts: [[r.at.x, r.at.y], ...(r.ey !== r.at.y ? [[r.at.x, r.ey]] : []), [r.lane, r.ey], ...(r.y !== r.ey ? [[r.lane, r.y]] : []), [hx, r.y]] }));
  const gearW = Math.max(...out.map((r) => wide(r.leads.map((l) => l.tag).join("  ")))), top = Math.max(...out.map((r) => r.y)) + P * 1.6, bottom = Math.min(...out.map((r) => r.y)) - P * 0.7;
  return { rows: out, jumpers, stay, pitch: P, hole, font, box: [bx - P * 0.3, bottom, gx + gearW + P * 0.4, top], cols: { tag: bx, holes: hx, gear: gx }, title: o.board ? `Plaque d'essai — ${o.board}` : "Plaque d'essai" };
}

/** Do two jumpers cross ? (segments that cut each other, not touching at an end) — what the layout must never give. */
export function crossings(jumpers) {
  const seg = (j) => j.pts.slice(1).map((q, i) => [j.pts[i], q]), out = [];
  const cut = ([a, b], [c, d]) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
    if (o1 && o2 && o3 && o4) return o1 !== o2 && o3 !== o4;
    const on = (p, q, r) => Math.min(p[0], q[0]) - 1e-9 <= r[0] && r[0] <= Math.max(p[0], q[0]) + 1e-9 && Math.min(p[1], q[1]) - 1e-9 <= r[1] && r[1] <= Math.max(p[1], q[1]) + 1e-9;
    return (!o1 && on(a, b, c)) || (!o2 && on(a, b, d)) || (!o3 && on(c, d, a)) || (!o4 && on(c, d, b)); };      // collinear and overlapping : two traces on each other — a crossing too
  for (let i = 0; i < jumpers.length; i++) for (let k = i + 1; k < jumpers.length; k++) for (const s of seg(jumpers[i])) for (const t of seg(jumpers[k])) if (cut(s, t)) out.push([jumpers[i].key, jumpers[k].key]);
  return out;
}
