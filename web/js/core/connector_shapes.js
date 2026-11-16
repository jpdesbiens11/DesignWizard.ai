/* DesignWizard.ai — what a connector looks like, by kind : a header with its pins, a circular with its nut and its gland, a
   shielded high-voltage one with its flange and its round ports, a terminal block with its screws… The shape is INDICATIVE :
   it tells the kinds apart and takes the right room, it is not the maker's drawing — nothing is copied from one. It is
   written once, as a few boxes and cylinders, and read twice : as the features of the part (expressions of L, W, H and e,
   so the envelope can still be set to the data sheet) and as plain solids for the 3D preview of the library.
   Frame : L along X (the row of poles), W along Y (the depth ; a wall-mounted connector mates toward −Y, its flange at
   y = 0), H along Z (a board-mounted one sits on z = 0 and mates upward). Pure : no kernel, no DOM. */

const r1 = (x) => Math.round(x * 10) / 10, r4 = (x) => Math.round(x * 1e4) / 1e4;
/** What each solid is made of, for the preview : the housing takes the colour of its domain. */
export const TONES = { housing: { lv: "#e6dfcc", hv: "#ef8a2b" }, dark: "#2f3640", metal: "#c8a24a", seal: "#56606e", lever: "#d9480f", cut: "#1d232b" };
export const SHAPE_WORDS = { "wire-to-board": "embase à picots", "wire-to-wire": "boîtier de faisceau", "board-to-board": "mezzanine", circular: "circulaire à écrou", ffc: "à volet pour nappe", "terminal-block": "bornier à vis", hv: "embase blindée à ports ronds", power: "blocs à lames", msd: "sectionneur à levier" };

/* the generators : (p = { L, W, H, e }, K = constants of the nominal envelope) → solids, every coordinate linear in p */
const box = (id, name, at, size, o = {}) => ({ id, name, shape: "box", at, size, ...o }), cyl = (id, name, at, axis, d, h, o = {}) => ({ id, name, shape: "cyl", at, axis, d, h, ...o });
const poleBody = (K, k) => (K.nets.length === 1 ? "contacts" : `pole${k + 1}`);
/** The flange and the body every wall-mounted connector shares ; holes in the corners of the flange. */
function wall(p, K, withNose = true) {
  const { L, H, e } = p, out = [box("bride", "Bride", [-e, 0, -e], [L + 2 * e, K.fl, H + 2 * e], { tone: "housing" })];
  for (const [i, x, z] of [[1, -e / 2, -e / 2], [2, L + e / 2, -e / 2], [3, -e / 2, H + e / 2], [4, L + e / 2, H + e / 2]]) out.push(cyl(`fix${i}`, "", [x, -0.2, z], "Y", K.fix, K.fl + 0.4, { cut: true }));
  if (withNose) out.push(box("nez", "Nez", [0, -K.nose, 0], [L, K.nose, H], { tone: "housing" }));
  return out;
}
const bars = (p, K, y0, len) => K.nets.flatMap((net, k) => { const x = p.L * (k + 1) / (K.nets.length + 1) - K.cw / 2, at = [x, y0, p.H / 2 - K.cw / 2], size = [K.cw, len, K.cw];
  return [box(`log${k + 1}`, "", at, size, { cut: true }), box(`ct${k + 1}`, `Contact ${net}`, at, size, { body: poleBody(K, k), tone: "metal" })]; });
const SHAPES = {
  "wire-to-board": (p, K) => { const { L, W, H } = p, t = K.wall, out = [box("corps", "Embase", [0, 0, 0], [L, W, H * 0.35], { tone: "housing" }), box("dos", "", [0, W - t, 0], [L, t, H], { tone: "housing" }), box("joue1", "", [0, 0, 0], [t, W, H], { tone: "housing" }), box("joue2", "", [L - t, 0, 0], [t, W, H], { tone: "housing" }), box("avant", "", [0, 0, 0], [L, t, H * 0.6], { tone: "housing" })];
    if (K.lock) out.push(box("verrou", "Verrou", [L * 0.3, W, H * 0.45], [L * 0.4, 0.8, H * 0.35], { tone: "housing" }));
    for (let k = 0; k < K.shown; k++) out.push(box(`ct${k + 1}`, "Picot", [L * (k + 1) / (K.shown + 1) - K.cw / 2, W / 2 - K.cw / 2, -K.tail], [K.cw, K.cw, H * 0.9 + K.tail], { body: "contacts", tone: "metal" }));
    return out; },
  "board-to-board": (p, K) => { const { L, W, H } = p, out = [box("corps", "Corps", [0, 0, 0], [L, W, H], { tone: "housing" }), box("fente", "", [L * 0.05, W * 0.3, H * 0.4], [L * 0.9, W * 0.4, H * 0.6 + 0.2], { cut: true })];
    for (let k = 0; k < K.shown; k++) for (const [s, y] of [["a", -0.3], ["b", W - 0.1]]) out.push(box(`ct${k + 1}${s}`, "Contact", [L * (k + 0.5) / K.shown - K.cw / 2, y, 0], [K.cw, 0.4, H * 0.5], { body: "contacts", tone: "metal" }));
    return out; },
  ffc: (p, K) => { const { L, W, H } = p, out = [box("corps", "Corps", [0, 0, 0], [L, W, H * 0.6], { tone: "housing" }), box("volet", "Volet", [L * 0.03, 0, H * 0.6], [L * 0.94, W * 0.45, H * 0.4], { tone: "dark" }), box("fente", "", [L * 0.05, -0.1, H * 0.25], [L * 0.9, W * 0.5, H * 0.2], { cut: true })];
    for (let k = 0; k < K.shown; k++) out.push(box(`ct${k + 1}`, "Contact", [L * (k + 0.5) / K.shown - K.cw / 2, W - 0.1, 0], [K.cw, 0.5, H * 0.3], { body: "contacts", tone: "metal" }));
    return out; },
  "terminal-block": (p, K) => { const { L, W, H } = p, out = [box("corps", "Corps", [0, 0, 0], [L, W, H * 0.75], { tone: "housing" }), box("rehausse", "", [0, W * 0.5, H * 0.75], [L, W * 0.5, H * 0.25], { tone: "housing" })];
    for (let k = 0; k < K.shown; k++) { const x = L * (k + 0.5) / K.shown; out.push(cyl(`entree${k + 1}`, "", [x, -0.1, H * 0.35], "Y", K.bore, W * 0.5, { cut: true }), cyl(`vis${k + 1}`, "Vis", [x, W * 0.75, H * 0.6], "Z", K.bore * 1.1, H * 0.4 + 0.6, { body: "contacts", tone: "metal" })); }
    return out; },
  circular: (p, K) => { const { L, W, H } = p, c = [L / 2, 0, H / 2], at = (y) => [c[0], y, c[2]], out = K.panel ? wall(p, K, false) : [], nose = Math.max(K.nose, 5);      // a circular connector has a threaded nose, on a wall or not
    out.push(cyl("corps", "Corps", at(K.fl), "Y", L * 0.92, W * 0.6, { tone: "housing" }), cyl("ecrou", "Écrou", at(K.fl), "Y", L * 1.22, 3, { tone: "metal" }), cyl("nez", "Nez fileté", at(-nose), "Y", L * 0.82, nose + 0.1, { tone: "metal" }),
      cyl("presse", "Presse-étoupe", at(K.fl + W * 0.6), "Y", L * 0.62, W * 0.4, { tone: "seal" }), cyl("alveole", "", at(-nose - 0.1), "Y", L * 0.6, nose * 0.7, { cut: true }));
    const n = K.nets.length === 1 ? K.shown : K.nets.length;
    for (let k = 0; k < n; k++) { const a = 2 * Math.PI * k / n, x = c[0] + Math.cos(a) * L * 0.18 * (n > 1 ? 1 : 0), z = c[2] + Math.sin(a) * L * 0.18 * (n > 1 ? 1 : 0); out.push(cyl(`ct${k + 1}`, "Contact", [x, -nose + 0.3, z], "Y", K.cw, nose + K.fl + W * 0.5, { body: K.nets.length === 1 ? "contacts" : `pole${k + 1}`, tone: "metal" })); }
    return out; },
  hv: (p, K) => { const { L, W, H } = p, out = [...(K.panel ? wall(p, K, false) : []), box("corps", "Corps", [0, K.fl, 0], [L, W, H], { tone: "housing" })];
    K.nets.forEach((net, k) => { const x = L * (k + 0.5) / K.nets.length, z = H / 2;
      out.push(cyl(`port${k + 1}`, "Port", [x, -K.nose, z], "Y", K.port, K.nose + 0.1, { tone: "housing" }), cyl(`log${k + 1}`, "", [x, -K.nose - 0.1, z], "Y", K.port * 0.62, K.nose + K.fl + W * 0.8, { cut: true }),
        cyl(`ct${k + 1}`, `Contact ${net}`, [x, -K.nose + 1.5, z], "Y", K.port * 0.42, K.nose + K.fl + W - 2, { body: poleBody(K, k), tone: "metal" }), cyl(`cable${k + 1}`, "Départ de câble", [x, K.fl + W, z], "Y", K.port * 0.8, W * 0.3, { tone: "seal" })); });
    if (K.hvil) for (const [i, dx] of [[1, -1.2], [2, 1.2]]) out.push(cyl(`hvil${i}`, "Interverrouillage", [L / 2 + dx, -K.nose * 0.6, H * 0.12], "Y", 0.9, K.nose * 0.6 + 1, { tone: "metal" }));
    return out; },
  power: (p, K) => { const { L, W, H } = p, n = K.nets.length, out = K.panel ? wall(p, K, false) : [], y0 = K.fl - (K.panel ? K.nose : 0), len = W + (K.panel ? K.nose : 0);
    K.nets.forEach((net, k) => { const x0 = L * k / n + 0.4, w = L / n - 0.8;
      out.push(box(`bloc${k + 1}`, "Bloc", [x0, y0, 0], [w, len, H], { tone: "housing" }), box(`log${k + 1}`, "", [x0 + w * 0.15, y0 - 0.1, H * 0.28], [w * 0.7, len * 0.45, H * 0.44], { cut: true }),
        box(`ct${k + 1}`, `Lame ${net}`, [x0 + w * 0.2, y0 + 0.6, H * 0.44], [w * 0.6, len - 1.2, H * 0.12], { body: poleBody(K, k), tone: "metal" })); });
    return out; },
  msd: (p, K) => { const { L, W, H } = p, out = [...(K.panel ? wall(p, K) : []), box("corps", "Corps", [0, K.fl, 0], [L, W, H], { tone: "housing" }), ...bars(p, K, -K.nose + 0.5, W + K.fl + K.nose - 1)];
    out.push(box("pied1", "", [L * 0.1, K.fl + W * 0.25, H], [L * 0.08, W * 0.14, H * 0.35], { tone: "lever" }), box("pied2", "", [L * 0.82, K.fl + W * 0.25, H], [L * 0.08, W * 0.14, H * 0.35], { tone: "lever" }), box("levier", "Levier", [L * 0.1, K.fl + W * 0.25, H * 1.35], [L * 0.8, W * 0.14, H * 0.12], { tone: "lever" }));
    return out; },
  "wire-to-wire": (p, K) => { const { L, W, H } = p, out = [...(K.panel ? wall(p, K) : []), box("corps", "Corps", [0, K.fl, 0], [L, W, H], { tone: "housing" }), box("joint", "Joint arrière", [L * 0.1, K.fl + W, H * 0.1], [L * 0.8, W * 0.25, H * 0.8], { tone: "seal" }), box("verrou", "Verrou", [L * 0.3, K.fl + W * 0.2, H], [L * 0.4, W * 0.5, H * 0.12], { tone: "housing" })];
    return [...out, ...bars(p, K, -(K.panel ? K.nose : 0) + 0.5, W + K.fl + (K.panel ? K.nose : 0) - 1)]; },
};
/** The constants of a shape : what does not follow the envelope when it is stretched (walls, pins, noses). */
export function shapeConstants(c, E, o) {
  const poles = Math.max(1, Math.round(o.poles || 1)), nets = o.nets, panel = !!o.panel, fl = panel ? 2 : 0, nose = panel ? r1(Math.min(12, E.W * 0.3)) : 0, pitch = c.pitch || E.L / (poles + 1);
  return { nets, panel, fl, nose, lock: !!c.lock, hvil: !!c.hvil, shown: Math.min(poles, 16), wall: r1(Math.max(0.5, Math.min(1.2, pitch * 0.3))), tail: 2.5, bore: r1(Math.max(1, pitch * 0.5)),
    cw: r1(Math.max(0.3, Math.min(E.L / (Math.max(nets.length, Math.min(poles, 16)) + 1) * 0.5, E.H * 0.4, pitch * 0.32 || 9))), fix: E.H > 30 ? 4.5 : 3.4, port: r1(Math.max(4, Math.min(E.L / nets.length * 0.72, E.H * 0.72))) };
}
/** The solids of a connector, in millimetres. c : the family ; E : { L, W, H } ; o : { poles, nets, panel, e }. */
export function connectorSolids(c, E, o) { return connectorSolidsAt(c, E, o, { L: E.L, W: E.W, H: E.H, e: o.e || 0 }); }
/** The same solids once the envelope is stretched to p = { L, W, H, e } : what does not follow it (walls, pins, noses) stays that of
    the envelope E the family came with. */
export function connectorSolidsAt(c, E, o, p) {
  const K = shapeConstants(c, E, o), gen = SHAPES[c.kind] || SHAPES["wire-to-wire"];
  return gen(p, K);
}
/** The same solids as features of the part language : boxes and cylinders whose sizes are expressions of L, W, H and e, so that the
    envelope stretches with its parameters. The expressions are read off the generator itself — it is linear in the four. */
export function connectorFeatures(c, E, o) {
  const K = shapeConstants(c, E, o), gen = SHAPES[c.kind] || SHAPES["wire-to-wire"], e0 = o.e || 0, at = (dL, dW, dH, de) => gen({ L: E.L + dL, W: E.W + dW, H: E.H + dH, e: e0 + de }, K);
  const base = at(0, 0, 0, 0), probes = [["L", at(1, 0, 0, 0), E.L], ["W", at(0, 1, 0, 0), E.W], ["H", at(0, 0, 1, 0), E.H], ...(o.panel ? [["e", at(0, 0, 0, 1), e0]] : [])];
  const expr = (pick) => { const v0 = pick(base); let k = v0; const terms = [];
    for (const [name, list, val] of probes) { const c1 = r4(pick(list) - v0); if (Math.abs(c1) < 1e-9) continue; k -= c1 * val; terms.push([name, c1]); }
    if (!terms.length) return r4(v0);
    let s = terms.map(([n, c1], i) => `${i ? (c1 < 0 ? " - " : " + ") : c1 < 0 ? "-" : ""}${Math.abs(c1) === 1 ? n : `${n}*${Math.abs(c1)}`}`).join(""); const kk = r4(k);
    return Math.abs(kk) < 1e-9 ? s : `${s} ${kk < 0 ? "-" : "+"} ${Math.abs(kk)}`; };
  return base.map((s, i) => { const get = (f) => (list) => f(list === base ? s : list[i]), v3 = (key) => [0, 1, 2].map((a) => expr(get((x) => x[key][a])));
    const common = { id: s.id, ...(s.name ? { name: s.name } : {}), ...(s.body ? { body: s.body } : {}), ...(s.cut ? { mode: "cut" } : {}) };
    return s.shape === "box" ? { op: "box", ...common, size: v3("size"), at: v3("at") } : { op: "cylinder", ...common, d: expr(get((x) => x.d)), h: expr(get((x) => x.h)), at: v3("at"), axis: s.axis }; });
}
