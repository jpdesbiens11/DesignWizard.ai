/* DynamiteOrbit.ai — connectors modelled series by series. A series of a maker is not copied : it is REBUILT, by a generator,
   from the dimensions its data sheet publishes — the pitch, the rows, how the length grows with the number of circuits,
   the depth, the height, the pin, the hole in the board. What comes out is the platform's own geometry : a housing that
   has the size and the look of the series (its silos, its shroud, its latch, its colour), pins where the board expects
   them, and the land pattern that goes with it. No drawing, no model and no logo of a maker is used.
   A generator : (S, n, o) → solids, in the frame of connector_shapes.js — L along X (the row of circuits), W along Y,
   H along Z ; a board-mounted connector sits on z = 0 and mates upward ; a wall-mounted one mates toward −Y, flange at y = 0.
   S : the dimensions of the series (connector_series.js) ; n : the number of circuits ; solids : boxes and cylinders, each
   with a colour or a tone, `cut` for what is hollow, `body` for what conducts. Pure. */

const r2 = (x) => Math.round(x * 100) / 100, r4 = (x) => Math.round(x * 1e4) / 1e4;
const box = (id, name, at, size, o = {}) => ({ id, name, shape: "box", at: at.map(r2), size: size.map(r2), ...o });
const cyl = (id, name, at, axis, d, h, o = {}) => ({ id, name, shape: "cyl", at: at.map(r2), axis, d: r2(d), h: r2(h), ...o });
const METAL = { tone: "metal", body: "contacts" };

/** How the circuits of a series are laid : columns along X, rows along Y. → { cols, rows, L, W, H, xy(c, r) } */
export function layout(S, n) {
  const rows = S.rows || 1, cols = Math.max(1, Math.ceil(n / rows)), L = r2(typeof S.length === "function" ? S.length(cols, n) : (cols - 1) * S.pitch + S.ends), W = S.depth, H = S.height, rp = S.rowPitch || S.pitch;
  const x0 = S.x0 !== undefined ? S.x0 : (L - (cols - 1) * S.pitch) / 2, y0 = S.y0 !== undefined ? S.y0 : W / 2 - (rows - 1) * rp / 2;
  return { cols, rows, n: cols * rows, L, W, H, xy: (c, r) => [r4(x0 + c * S.pitch), r4(y0 + r * rp)], num: (c, r) => (S.byRow ? r * cols + c + 1 : c * rows + r + 1) };
}
const each = (G, fn) => { const out = []; for (let c = 0; c < G.cols; c++) for (let r = 0; r < G.rows; r++) out.push(...fn(c, r, G.num(c, r))); return out; };
const MANY = 24;      // past this number of circuits, the leads of a fine-pitch connector are drawn as one comb : the picture stays the same, the part stays light
const comb = (S, G, y, len, id = "peigne") => { const [x0] = G.xy(0, 0), [x1] = G.xy(G.cols - 1, 0); return box(id, "Leads", [x0 - S.lead[0] / 2, y, 0], [x1 - x0 + S.lead[0], len, 0.15], METAL); };
const pin = (S, G) => (c, r, k) => { const [x, y] = G.xy(c, r), s = S.pin; return [S.round ? cyl(`p${k}`, "Pin", [x, y, -S.tail], "Z", s, S.tail + S.pinUp, METAL) : box(`p${k}`, "Pin", [x - s / 2, y - s / 2, -S.tail], [s, s, S.tail + S.pinUp], METAL)]; };
const smt = (S, G) => (c, r, k) => { const [x] = G.xy(c, r), lw = S.lead[0], ll = S.lead[1], front = G.rows === 1 ? (S.leadSide || 1) : r === 0 ? -1 : 1, y = front < 0 ? -ll * 0.6 : G.W - ll * 0.4;
  return [box(`p${k}`, "Lead", [x - lw / 2, y, 0], [lw, ll, 0.2], METAL)]; };

/* the box of a sealed housing : a table by number of ways when the series has one, a rule (cols, rows) → [L, H, W] otherwise */
const sealedBox = (S, n) => { const rows = S.rowsOf ? S.rowsOf(n) : n > 3 ? 2 : 1, cols = Math.ceil(n / rows), [L, H, W] = S.sizes ? S.sizes[n] || S.sizes[Object.keys(S.sizes)[0]] : S.size(cols, rows, n); return { L, H, W, rows, cols }; };
const hvBox = (S, n) => { const [L, H, W, nose] = S.sizes ? S.sizes[n] || S.sizes[Object.keys(S.sizes)[0]] : S.size(n); return { L, H, W, nose }; };
/* the rows of a D-subminiature : two, the first one longer by one — three at 50 ways */
const dsubRows = (n) => (n === 50 ? [17, 16, 17] : [Math.ceil(n / 2), Math.floor(n / 2)]);
const dsubPins = (S, n, A) => { const rows = dsubRows(n), out = []; rows.forEach((cnt, r) => { for (let c = 0; c < cnt; c++) out.push([A / 2 - (cnt - 1) * S.pitch / 2 + c * S.pitch, S.depth / 2 + (r - (rows.length - 1) / 2) * S.rowPitch]); }); return out; };

const MODELS = {
  /* a shrouded header : a floor, four walls — or one silo per circuit —, a latch on a long side, pegs under it */
  shroud(S, n) {
    const G = layout(S, n), { L, W, H } = G, t = S.wall, f = S.floor, col = { color: S.color }, out = [box("fond", "Housing", [0, 0, 0], [L, W, f], col)];
    if (S.silos) { out.push(box("corps", "Housing", [0, 0, f], [L, W, H - f], col));
      out.push(...each(G, (c, r, k) => { const [x, y] = G.xy(c, r), a = S.silos; return [box(`s${k}`, "", [x - a / 2, y - a / 2, f + 0.4], [a, a, H - f - 0.35], { cut: true })]; })); }
    else { out.push(box("dos", "", [0, W - t, f], [L, t, H - f], col), box("avant", "", [0, 0, f], [L, t, (H - f) * (S.front || 1)], col), box("joue1", "", [0, 0, f], [t, W, H - f], col), box("joue2", "", [L - t, 0, f], [t, W, H - f], col));
      for (const [i, u] of (typeof S.slots === "function" ? S.slots(n) : S.slots || []).entries()) out.push(box(`fente${i + 1}`, "", [L * u - S.slotW / 2, -0.05, H - (H - f) * 0.55], [S.slotW, t + 0.1, (H - f) * 0.55 + 0.05], { cut: true })); }
    if (S.latch) { const [w, d, h, z] = S.latch, y = S.latchSide === "+Y" ? W : -d; out.push(box("verrou", "Latch", [L / 2 - w / 2, y, z], [w, d, h], col)); }
    for (const [i, [u, v]] of (S.pegs || []).entries()) out.push(cyl(`pion${i + 1}`, "Peg", [u < 0 ? L + u : u, v < 0 ? W + v : v, -S.pegH], "Z", S.pegD, S.pegH, col));
    if (S.tab) for (const [i, x] of [-S.tab[0] * 0.1, L - S.tab[0] * 0.9].entries()) out.push(box(`patte${i + 1}`, "Solder tab", [x, W * 0.2, 0], [S.tab[0], S.tab[1], 0.2], { tone: "metal" }));
    return [...out, ...each(G, S.lead ? smt(S, G) : pin(S, G))];
  },
  /* a bare strip of square posts */
  strip(S, n) { const G = layout(S, n), col = { color: S.color }; return [...each(G, (c, r, k) => { const [x, y] = G.xy(c, r), a = S.pitch; return [box(`b${k}`, c + r ? "" : "Housing", [x - a / 2 + 0.05, y - a / 2 + 0.05, 0], [a - 0.1, a - 0.1, S.height], col)]; }), ...each(G, pin(S, G))]; },
  /* a pluggable terminal block header : a tall back, an open front, one pin per pole */
  terminal(S, n) { const G = layout(S, n), { L, W, H } = G, col = { color: S.color }, out = [box("fond", "Housing", [0, 0, 0], [L, W, S.floor], col), box("dos", "", [0, W - S.wall, 0], [L, S.wall, H], col), box("joue1", "", [0, 0, 0], [S.wall, W, H], col), box("joue2", "", [L - S.wall, 0, 0], [S.wall, W, H], col)];
    for (let c = 1; c < G.cols; c++) out.push(box(`cl${c}`, "", [G.xy(c, 0)[0] - S.pitch / 2 - 0.4, W * 0.35, 0], [0.8, W * 0.65, H * 0.8], col));
    return [...out, ...each(G, (c, r, k) => { const [x, y] = G.xy(c, r), a = S.pin; return [box(`p${k}`, "Pin", [x - a / 2, y - a / 2, -S.tail], [a, a, S.tail + H * 0.45 + a / 2], METAL), box(`lame${k}`, "", [x - a / 2, 1.2, H * 0.45 - a / 2], [a, y - 1.2, a], METAL)]; })]; },
  /* a D-subminiature : a flange, a D-shaped shell, an insulator, two rows of pins */
  dsub(S, n) { const D = S.sizes[n] || S.sizes[9], [A, B, C] = D, counts = dsubRows(n), out = [];
    out.push(box("bride", "Flange", [0, 0, 0], [A, S.depth, S.flange], { color: S.steel || "#b9bec6" }), box("coque", "Shell", [(A - C) / 2, (S.depth - S.shell) / 2, S.flange], [C, S.shell, S.height - S.flange], { color: S.steel || "#b9bec6" }), box("isolant", "Insulator", [(A - C) / 2 + 0.8, (S.depth - S.shell) / 2 + 0.8, S.flange + 0.6], [C - 1.6, S.shell - 1.6, S.height - S.flange - 0.5], { color: S.color }));
    for (const [i, x] of [(A - B) / 2, (A + B) / 2].entries()) out.push(cyl(`fix${i + 1}`, "", [x, S.depth / 2, -0.1], "Z", S.fix, S.flange + 0.2, { cut: true }));
    for (const [k, [x, y]] of dsubPins(S, n, A).entries()) out.push(cyl(`p${k + 1}`, "Pin", [x, y, -S.tail], "Z", S.pin, S.tail + S.height - 0.6, METAL));
    return counts.length ? out : []; },
  /* a flat cable connector : a low body, a flip lock, leads at the back, two solder tabs */
  ffc(S, n) { const G = layout(S, n), { L, W, H } = G, out = [box("corps", "Housing", [0, W * 0.35, 0], [L, W * 0.65, H], { color: S.color }), box("volet", "Actuator", [L * 0.03, 0, H * 0.35], [L * 0.94, W * 0.4, H * 0.65], { color: S.lock }), box("fente", "", [L * 0.06, -0.05, H * 0.12], [L * 0.88, W * 0.5, H * 0.22], { cut: true })];
    for (const [i, x] of [-S.tab[0] * 0.6, L - S.tab[0] * 0.4].entries()) out.push(box(`patte${i + 1}`, "Solder tab", [x, W * 0.2, 0], [S.tab[0], S.tab[1], 0.2], { tone: "metal" }));
    return [...out, ...(G.cols > MANY ? [comb(S, G, W - 0.1, S.lead[1])] : each(G, (c, r, k) => { const [x] = G.xy(c, r); return [box(`p${k}`, "Lead", [x - S.lead[0] / 2, W - 0.1, 0], [S.lead[0], S.lead[1], 0.15], METAL)]; }))]; },
  /* a board-to-board mezzanine : a low frame, a slot, two rows of leads */
  mezz(S, n) { const G = layout(S, n), { L, W, H } = G, out = [box("corps", "Housing", [0, 0, 0], [L, W, H], { color: S.color }), box("fente", "", [L * 0.06, W * 0.3, H * 0.35], [L * 0.88, W * 0.4, H], { cut: true })]; return [...out, ...(G.cols > MANY ? [comb(S, G, -S.lead[1] * 0.6, S.lead[1], "peigne1"), comb(S, G, W - S.lead[1] * 0.4, S.lead[1], "peigne2")] : each(G, smt(S, G)))]; },
  /* a sealed harness housing : cavities in rows, a rear seal, a latch — and, for some series, a wedge lock in the mating face */
  sealed(S, n) { const { L, H, W, rows, cols } = sealedBox(S, n), col = { color: S.color }, out = [box("corps", "Housing", [0, 0, 0], [L, W, H], col)];
    if (S.seal !== false) out.push(box("joint", "Rear seal", [L * 0.08, W, H * 0.1], [L * 0.84, W * 0.12, H * 0.8], { color: S.seal || "#3d4450" }));
    out.push(box("verrou", "Latch", [L * 0.3, W * 0.15, H], [L * 0.4, W * 0.55, H * 0.1], col));
    if (S.towers) for (let k = 0; k < n; k++) { const r = Math.floor(k / cols), c = k % cols; out.push(cyl(`tour${k + 1}`, "Tower", [L * (c + 0.5) / cols, -S.towers, H * (r + 0.5) / rows], "Y", S.cavity * 1.55, S.towers + 0.1, col)); }
    if (S.wedge) out.push(box("coin", "Wedge lock", [L * 0.12, -0.6, H * 0.14], [L * 0.76, 0.8, H * 0.72], { color: S.wedge }));
    for (let k = 0; k < n; k++) { const r = Math.floor(k / cols), c = k % cols, x = L * (c + 0.5) / cols, z = H * (r + 0.5) / rows, y = -(S.towers || 0); out.push(cyl(`c${k + 1}`, "", [x, y - 0.7, z], "Y", S.cavity, W * 0.6, { cut: true }), cyl(`p${k + 1}`, "Contact", [x, y + 0.8, z], "Y", S.contact, W * 0.9, METAL)); }
    return out; },
  /* a circular connector on a wall : a flange or a nut, a threaded nose, the pins on their circle */
  circular(S, n) { const d = S.thread, D = S.flange ? S.body : d, e = S.flange ? (S.flange - D) / 2 : 0, c = [D / 2, 0, D / 2], at = (y) => [c[0], y, c[2]], out = [], M = S.shell ? { color: S.shell } : { tone: "metal" }, t = S.flange ? S.flangeT : S.nutT;
    if (S.flange) { out.push(box("bride", "Flange", [-e, 0, -e], [S.flange, t, S.flange], M)); for (const [i, [u, v]] of [[-1, -1], [1, -1], [-1, 1], [1, 1]].entries()) out.push(cyl(`fix${i + 1}`, "", [c[0] + u * S.holes / 2, -0.1, c[2] + v * S.holes / 2], "Y", S.fix, t + 0.2, { cut: true })); }
    else out.push(cyl("ecrou", "Hex nut", at(0), "Y", S.nut, t, M));
    out.push(cyl("nez", "Threaded nose", at(-S.nose), "Y", d, S.nose + 0.1, M), cyl("corps", "Body", at(t), "Y", S.body, S.back, { color: S.color }), cyl("alveole", "", at(-S.nose - 0.1), "Y", d * 0.72, S.nose * 0.7, { cut: true }));
    for (let k = 0; k < n; k++) { const a = 2 * Math.PI * k / n + Math.PI / 2, rr = n > 1 ? S.circle / 2 : 0; out.push(cyl(`p${k + 1}`, "Pin", [c[0] + Math.cos(a) * rr, -S.nose + 0.4, c[2] + Math.sin(a) * rr], "Y", S.pin, S.nose + S.back * 0.6, { tone: "metal", body: "contacts" })); }
    return out; },
  /* a high-voltage header on a wall : a flange with its screws, a body behind it, and a mating face of its own — one shroud with a round
     port or a blade slot per pole, or one round tower per pole — with the lock (CPA) or the lever of the series, and the interlock pins */
  hvheader(S, n) { const { L, H, W, nose } = hvBox(S, n), fl = S.flangeT, e = S.flangeE, col = { color: S.color }, out = [box("bride", "Flange", [-e, 0, -e], [L + 2 * e, fl, H + 2 * e], col)];
    for (const [i, [x, z]] of [[-e / 2, -e / 2], [L + e / 2, -e / 2], [-e / 2, H + e / 2], [L + e / 2, H + e / 2]].entries()) out.push(cyl(`fix${i + 1}`, "", [x, -0.1, z], "Y", S.fix, fl + 0.2, { cut: true }));
    out.push(box("corps", "Body", [0, fl, 0], [L, W, H], col)); if (!S.towers) out.push(box("nez", "Shroud", [L * 0.04, -nose, H * 0.06], [L * 0.92, nose, H * 0.88], col));
    for (let k = 0; k < n; k++) { const x = S.pitch ? L / 2 + (k - (n - 1) / 2) * S.pitch : L * (k + 0.5) / n, z = H / 2, pole = { tone: "metal", body: n === 1 ? "contacts" : `pole${k + 1}` }, y = -nose * 0.6, len = nose * 0.6 + fl + W * 0.9;
      if (S.towers) out.push(cyl(`tour${k + 1}`, "Shroud", [x, -nose, z], "Y", S.port * 1.3, nose, col));
      if (S.blade) out.push(box(`port${k + 1}`, "", [x - S.port / 2, -nose - 0.1, z - S.port * 0.3], [S.port, nose * 0.8, S.port * 0.6], { cut: true }), box(`p${k + 1}`, "Contact", [x - S.contact / 2, y, z - S.blade / 2], [S.contact, len, S.blade], pole));
      else out.push(cyl(`port${k + 1}`, "", [x, -nose - 0.1, z], "Y", S.port, nose * 0.8, { cut: true }), cyl(`p${k + 1}`, "Contact", [x, y, z], "Y", S.contact, len, pole));
      out.push(cyl(`cable${k + 1}`, "Cable outlet", [x, fl + W, z], "Y", S.port * 0.9, W * 0.25, { color: "#3d4450" })); }
    if (S.cpa) out.push(box("cpa", "Lock (CPA)", [L * 0.36, -nose * 0.8, S.towers ? H * 0.5 + S.port * 0.6 : H * 0.94], [L * 0.28, nose * 0.55, Math.max(1.5, H * 0.07)], { color: S.cpa }));
    if (S.lever) out.push(box("levier1", "", [-1.6, -nose * 0.9, H * 0.3], [1.6, nose * 0.8, H * 0.6], { color: S.lever }), box("levier2", "", [L, -nose * 0.9, H * 0.3], [1.6, nose * 0.8, H * 0.6], { color: S.lever }), box("levier", "Lever", [-1.6, -nose * 0.9, H * 0.9], [L + 3.2, nose * 0.28, Math.max(2, H * 0.08)], { color: S.lever }));
    if (S.hvil) for (const [i, dx] of [[1, -1.3], [2, 1.3]]) out.push(cyl(`hvil${i}`, "Interlock", [L / 2 + dx, -nose * 0.55, H * 0.16], "Y", 0.9, nose * 0.55 + 1, { tone: "metal" }));
    return out; },
  /* a single-pole power connector : a round barrel, its contact, a collar — `barrel` is its largest diameter, the collar's */
  barrel(S) { const D = S.barrel, d = D * 0.85, c = D / 2, out = [cyl("fut", "Barrel", [c, 0, c], "Y", d, S.length, { color: S.color }), cyl("collet", "Collar", [c, S.length * 0.3, c], "Y", D, S.length * 0.12, { color: S.color }), cyl("alveole", "", [c, -0.1, c], "Y", d * 0.7, S.length * 0.35, { cut: true }), cyl("p1", "Contact", [c, 0.6, c], "Y", S.contact, S.length * 0.8, METAL)];
    if (S.elbow) out.push(cyl("coude", "Cable outlet", [c, S.length - d * 0.55, c], "Z", d * 0.85, S.elbow, { color: S.color })); return out; },
  /* flat-contact housings that stack : one block per pole, a tongue, a flat contact */
  stack(S, n) { const [w, h, len] = S.block, out = []; for (let k = 0; k < n; k++) { const x = k * w, col = { color: (S.colors || [S.color])[k % (S.colors || [S.color]).length] };
    out.push(box(`bloc${k + 1}`, "Housing", [x, 0, 0], [w - 0.15, len, h], col), box(`log${k + 1}`, "", [x + w * 0.15, -0.1, h * 0.3], [w * 0.7, len * 0.45, h * 0.4], { cut: true }), box(`p${k + 1}`, "Contact", [x + w * 0.22, 0.6, h * 0.44], [w * 0.56, len - 1.2, h * 0.12], { tone: "metal", body: n === 1 ? "contacts" : `pole${k + 1}` })); }
    return out; },
  /* a two-pole flat housing with its two contacts side by side, and two holes to fix it */
  flat(S) { const [len, w, t] = S.size, col = { color: S.color }, out = [box("corps", "Housing", [0, 0, 0], [w, len, t], col), box("creux", "", [w * 0.08, -0.1, t * 0.22], [w * 0.84, len * 0.42, t * 0.56], { cut: true })];
    for (const [i, x] of (S.gap ? [w / 2 - S.gap / 2, w / 2 + S.gap / 2] : [w * 0.28, w * 0.72]).entries()) out.push(S.pinD ? cyl(`p${i + 1}`, "Contact", [x, 0.5, t / 2], "Y", S.pinD, len - 1, { tone: "metal", body: `pole${i + 1}` }) : box(`p${i + 1}`, "Contact", [x - w * 0.13, 0.6, t * 0.42], [w * 0.26, len - 1.2, t * 0.16], { tone: "metal", body: `pole${i + 1}` }));
    for (const [i, x] of (S.holes ? [w * 0.5 - S.holes / 2, w * 0.5 + S.holes / 2] : []).entries()) out.push(cyl(`fix${i + 1}`, "", [x, len * 0.72, -0.1], "Z", S.fix, t + 0.2, { cut: true }));
    if (S.chamfer) out.push(box("detrompeur", "", [w - S.chamfer, -0.05, -0.05], [S.chamfer + 0.05, len * 0.5, S.chamfer], { cut: true })); return out; },
  /* a cable coupler : a slim body, a locking sleeve, a cable nut — `d` is its largest diameter, the sleeve's */
  coupler(S) { const D = S.d, d = D * 0.9, c = D / 2; return [cyl("corps", "Coupler", [c, 0, c], "Y", d, S.length, { color: S.color }), cyl("manchon", "Locking sleeve", [c, S.length * 0.42, c], "Y", D, S.length * 0.2, { color: S.color }), cyl("ecrou", "Cable nut", [c, S.length * 0.82, c], "Y", D * 0.94, S.length * 0.18, { color: S.color }), cyl("alveole", "", [c, -0.1, c], "Y", d * 0.6, S.length * 0.3, { cut: true }), cyl("p1", "Contact", [c, 0.5, c], "Y", S.contact, S.length * 0.5, METAL)]; },
  /* a service disconnect on a wall : a base behind it, a plug that carries the fuse toward the outside, a lever over the plug */
  disconnect(S) { const [L, H, W, out] = S.base, col = { color: S.color }, lev = { color: S.lever }; return [box("bride", "Flange", [-S.flangeE, 0, -S.flangeE], [L + 2 * S.flangeE, S.flangeT, H + 2 * S.flangeE], col), box("base", "Base", [0, S.flangeT, 0], [L, W, H], col), box("fiche", "Plug", [L * 0.06, -out, H * 0.08], [L * 0.88, out, H * 0.84], col),
    box("pied1", "", [L * 0.02, -out * 0.75, H * 0.92], [L * 0.07, out * 0.3, H * 0.16], lev), box("pied2", "", [L * 0.91, -out * 0.75, H * 0.92], [L * 0.07, out * 0.3, H * 0.16], lev), box("levier", "Lever", [L * 0.02, -out * 0.75, H * 1.08], [L * 0.96, out * 0.3, H * 0.07], lev),
    box("p1", "Contact HV+", [L * 0.2, S.flangeT + W - 1, H * 0.35], [L * 0.12, 7, H * 0.3], { tone: "metal", body: "pole1" }), box("p2", "Contact HV−", [L * 0.68, S.flangeT + W - 1, H * 0.35], [L * 0.12, 7, H * 0.3], { tone: "metal", body: "pole2" })]; },
};
export const MODEL_KINDS = Object.keys(MODELS);

/** The solids of a series for n circuits. S : its dimensions ; → [] when the series has no model. */
export function modelSolids(S, n) { const gen = S && MODELS[S.model]; return gen ? gen(S, Math.max(1, Math.round(n))) : []; }
/** The box that holds the solids of a series : { L, W, H, min [x, y, z] }. */
export function solidsBox(solids) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], ax = { X: 0, Y: 1, Z: 2 };
  for (const s of solids) { if (s.cut) continue; const a = s.shape === "box" ? s.at : s.at.map((v, i) => (i === ax[s.axis] ? v : v - s.d / 2)), b = s.shape === "box" ? s.at.map((v, i) => v + s.size[i]) : s.at.map((v, i) => (i === ax[s.axis] ? v + s.h : v + s.d / 2));
    for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], a[i], b[i]); hi[i] = Math.max(hi[i], a[i], b[i]); } }
  return Number.isFinite(lo[0]) ? { L: r2(hi[0] - lo[0]), W: r2(hi[1] - lo[1]), H: r2(hi[2] - lo[2]), min: lo.map(r2) } : { L: 0, W: 0, H: 0, min: [0, 0, 0] };
}
/** Where a series sits : on a board (it mates upward) or on a wall, a cable or a harness (it mates toward −Y). */
export const BOARD_MODELS = ["shroud", "strip", "terminal", "dsub", "ffc", "mezz"];
export const onBoard = (S) => !!S && BOARD_MODELS.includes(S.model);
/** The envelope of a series for n circuits, as the part gives it to its interfaces : { L, W, H, e } — L along the row, W the depth
    (behind the wall for a wall-mounted one), H the height, e how far its flange goes past the body (0 without a flange). */
export function modelEnvelope(S, n) {
  const k = Math.max(1, Math.round(n)), E = (L, W, H, e = 0) => ({ L: r2(L), W: r2(W), H: r2(H), e: r2(e) });
  switch (S && S.model) {
    case "shroud": case "strip": case "terminal": case "ffc": case "mezz": { const G = layout(S, k); return E(G.L, G.W, G.H); }
    case "dsub": { const D = S.sizes[k] || S.sizes[9]; return E(D[0], S.depth, S.height); }
    case "sealed": { const B = sealedBox(S, k); return E(B.L, B.W, B.H); }
    case "hvheader": { const B = hvBox(S, k); return E(B.L, B.W, B.H, S.flangeE); }
    case "circular": return S.flange ? E(S.body, S.back, S.body, (S.flange - S.body) / 2) : E(S.thread, S.back, S.thread);
    case "barrel": return E(S.barrel, S.length, S.barrel);
    case "coupler": return E(S.d, S.length, S.d);
    case "stack": return E(S.block[0] * k, S.block[2], S.block[1]);
    case "flat": return E(S.size[1], S.size[0], S.size[2]);
    case "disconnect": return E(S.base[0], S.base[2], S.base[1], S.flangeE);
    default: return null;
  }
}
/** The land pattern of a board-mounted series for n circuits, centred on the body : { pads, body [L, W, H], courtyard [L, W] } in the
    pad format of the boards (pcba/footprints.js) — pin 1 square, a hole per pin (or a pad per lead), the pegs as plain holes. null
    when the series does not sit on a board, or does not exist with that number of circuits. */
export function modelFootprint(S, n) {
  if (!onBoard(S)) return null;
  const r3 = (v) => Math.round(v * 1000) / 1000;
  if (S.model === "dsub") { if (!S.sizes[Math.round(n)]) return null; const A = S.sizes[Math.round(n)], land = r3(S.drill + 0.7), list = dsubPins(S, Math.round(n), A[0]).map(([x, y], k) => ({ n: String(k + 1), x: r3(x - A[0] / 2), y: r3(y - S.depth / 2), w: land, h: land, shape: k ? "round" : "rect", drill: S.drill }));
    for (const [i, x] of [-A[1] / 2, A[1] / 2].entries()) list.push({ n: `MP${i + 1}`, x: r3(x), y: 0, w: r3(S.fix + 2), h: r3(S.fix + 2), shape: "round", drill: S.fix });
    return { pads: list, body: [A[0], S.depth, S.height], courtyard: [r3(A[0] + 0.5), r3(S.depth + 0.5)] }; }
  if ((S.rows || 1) > 1 && Math.round(n) % S.rows) return null;
  const G = layout(S, Math.max(1, Math.round(n))), cx = G.L / 2, cy = G.W / 2, pads = [];
  for (let c = 0; c < G.cols; c++) for (let r = 0; r < G.rows; r++) { const k = G.num(c, r), [x, y] = G.xy(c, r);
    if (S.lead) { const [pw, pl] = S.pad, front = G.rows === 1 ? (S.model === "ffc" ? 1 : S.leadSide || 1) : r === 0 ? -1 : 1, py = front < 0 ? -pl / 2 + 0.3 : G.W + pl / 2 - 0.3; pads.push({ n: String(k), x: r3(x - cx), y: r3(py - cy), w: pw, h: pl, shape: "rect" }); }
    else { const land = r3(S.drill + (S.ring || 0.35) * 2); pads.push({ n: String(k), x: r3(x - cx), y: r3(y - cy), w: land, h: land, shape: k === 1 ? "rect" : "round", drill: S.drill }); } }
  pads.sort((a, b) => +a.n - +b.n);
  for (const [i, [u, v]] of (S.pegs || []).entries()) pads.push({ n: `MP${i + 1}`, x: r3((u < 0 ? G.L + u : u) - cx), y: r3((v < 0 ? G.W + v : v) - cy), w: S.pegD + 0.1, h: S.pegD + 0.1, shape: "round", drill: r3(S.pegD + 0.1), plated: false });
  if (S.tab) for (const [i, x] of [-S.tab[0] * 0.1, G.L - S.tab[0] * 0.9].entries()) pads.push({ n: `MP${i + 1}`, x: r3(x + S.tab[0] / 2 - cx), y: r3(G.W * 0.2 + S.tab[1] / 2 - cy), w: S.tab[0], h: S.tab[1], shape: "rect" });
  return { pads, body: [G.L, G.W, G.H], courtyard: [r3(G.L + 0.5 + (S.tab ? S.tab[0] * 0.2 : 0)), r3(G.W + 0.5 + (S.lead ? S.pad[1] : 0) + (S.latch ? S.latch[1] : 0))] };
}
