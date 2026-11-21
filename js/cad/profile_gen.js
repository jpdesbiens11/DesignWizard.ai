/* DesignWizard.ai — profile generators: usual cross-sections described by a few numbers, e.g.
   {"gen":"heatsink","W":80,"base":5,"fin":18,"tf":2,"n":9}. They return an ordinary profile definition (poly / outer + holes),
   so everything downstream (extrusion, DFM metrics, drawings) treats them like a hand-drawn profile. */

const need = (o, keys, gen) => { for (const k of keys) if (typeof o[k] !== "number" || !Number.isFinite(o[k])) throw new Error(`Profil « ${gen} » : « ${k} » doit être un nombre (reçu ${JSON.stringify(o[k])}).`); };

export const PROFILE_GENERATORS = {
  /** Flat base with n straight fins. Origin at the bottom-left corner of the base. */
  heatsink(o) {
    need(o, ["W", "base", "fin", "tf", "n"], "heatsink");
    const n = Math.max(2, Math.round(o.n)), gap = (o.W - n * o.tf) / (n - 1);
    if (gap <= 0.2) throw new Error(`Profil « heatsink » : ${n} ailettes de ${o.tf} mm ne tiennent pas dans ${o.W} mm. Correctif : réduisez le nombre ou l'épaisseur des ailettes.`);
    const r = Math.max(0, Math.min(o.r ?? 0.5, o.tf / 2 - 0.05, gap / 2 - 0.05)), top = o.base + o.fin, pts = [[0, 0], [o.W, 0]];
    for (let i = n - 1; i >= 0; i--) {
      const x0 = i * (o.tf + gap), x1 = x0 + o.tf;
      pts.push([x1, top, r], [x0, top, r]);
      if (i > 0) pts.push([x0, o.base, r], [x0 - gap, o.base, r]);
    }
    return { poly: pts };
  },
  /** U channel, open at the top. */
  channel(o) {
    need(o, ["W", "H", "t"], "channel");
    const r = o.r ?? Math.min(1, o.t / 2);
    return { poly: [[0, 0, r], [o.W, 0, r], [o.W, o.H], [o.W - o.t, o.H], [o.W - o.t, o.t, r], [o.t, o.t, r], [o.t, o.H], [0, o.H]] };
  },
  /** L angle. */
  angle(o) {
    need(o, ["A", "B", "t"], "angle");
    const r = o.r ?? Math.min(1, o.t / 2);
    return { poly: [[0, 0], [o.A, 0], [o.A, o.t], [o.t, o.t, r], [o.t, o.B], [0, o.B]] };
  },
  /** Rectangular tube. */
  tube(o) {
    need(o, ["W", "H", "t"], "tube");
    const r = o.r ?? Math.min(2, o.t);
    return { outer: { rect: [0, 0, o.W, o.H], r }, holes: [{ rect: [o.t, o.t, o.W - 2 * o.t, o.H - 2 * o.t], r: Math.max(0, r - o.t / 2) }] };
  },
  round_tube(o) {
    need(o, ["D", "t"], "round_tube");
    return { outer: { circle: [0, 0, o.D] }, holes: [{ circle: [0, 0, o.D - 2 * o.t] }] };
  },
  /** Electronics enclosure: rectangular tube whose side walls carry card-guide grooves for boards.
      slots: number of board levels, slot_t: groove width (board thickness + clearance), slot_d: groove depth,
      first: height of the first groove above the inner floor, pitch: spacing between grooves. */
  card_enclosure(o) {
    need(o, ["W", "H", "t"], "card_enclosure");
    const n = Math.max(0, Math.round(o.slots ?? 1)), st = o.slot_t ?? 1.9, sd = o.slot_d ?? 1.5, first = o.first ?? 6, pitch = o.pitch ?? 15;
    const side = o.wall_side ?? Math.max(o.t, sd + 1.2), r = o.r ?? 2, x0 = side, x1 = o.W - side, y0 = o.t, y1 = o.H - o.t, ri = 0.4;
    if (x1 - x0 < 2 || y1 - y0 < 2) throw new Error("Profil « card_enclosure » : les parois sont plus épaisses que le profilé.");
    const inner = [[x0, y0, ri], [x1, y0, ri]];
    for (let i = 0; i < n; i++) { const y = y0 + first + i * pitch; if (y + st > y1 - 0.5) break; inner.push([x1, y], [x1 + sd, y, 0.2], [x1 + sd, y + st, 0.2], [x1, y + st]); }
    inner.push([x1, y1, ri], [x0, y1, ri]);
    for (let i = n - 1; i >= 0; i--) { const y = y0 + first + i * pitch; if (y + st > y1 - 0.5) continue; inner.push([x0, y + st], [x0 - sd, y + st, 0.2], [x0 - sd, y, 0.2], [x0, y]); }
    return { outer: { rect: [0, 0, o.W, o.H], r }, holes: [{ poly: inner }] };
  },
  /** A profile fitted to what it holds : a tube (or a U channel when `open`) of one wall t, whose side walls carry
      - rails : [{ y, g, d, w }] — a groove of width g and depth d at height y (its middle), made by two ribs, for a tongue of
        width w that slides in (the groove bottoms stand w + 2c apart, c = `c`, 0.15 by default) ;
      - ledges : [{ y, w }] — two ribs whose top is at height y, 3 mm under each edge of something of width w that rests flat ;
      - ports : { d, b } — a boss of side b in each inner corner with a hole Ø d, for the self-tapping screws of the end plates.
      Heights are measured from the outside of the floor. Everything is symmetric about the middle of the width. */
  fitted(o) {
    need(o, ["W", "H", "t"], "fitted");
    const t = o.t, W = o.W, H = o.H, open = !!o.open, c = o.c ?? 0.15, x0 = t, x1 = W - t, y0 = t, y1 = open ? H : H - t, mid = W / 2, tf = o.tf ?? t, ri = Math.min(0.5, t / 2), b = o.ports && o.ports.b > 0 ? o.ports.b : 0;
    if (x1 - x0 < 2 || y1 - y0 < 2) throw new Error("Profil « fitted » : les parois sont plus épaisses que le profilé.");
    const rad = (...lens) => Math.max(0, Math.min(0.4, ...lens.map((l) => l / 2 - 0.05)));
    const ribs = [];                                            // what stands on the right wall, bottom to top : [y bottom, y top, points from the wall and back]
    for (const r of o.rails || []) {
      const xb = Math.min(x1, mid + r.w / 2 + c + (r.relief || 0)), xt = xb - r.d, ya = r.y - r.g / 2 - tf, q = rad(tf, r.d, r.g);
      if (xt <= mid + 0.5) throw new Error(`Profil « fitted » : la glissière à ${r.y} mm est plus profonde que la moitié de ce qu'elle tient.`);
      const top = ya + 2 * tf + r.g, fill = x1 - xb;          // fill : what separates the bottom of the groove from the wall
      ribs.push([ya, top, fill < 1e-6 ? [[x1, ya, q], [xt, ya, q], [xt, ya + tf, q], [x1, ya + tf, q], [x1, ya + tf + r.g, q], [xt, ya + tf + r.g, q], [xt, top, q], [x1, top, q]]
        : fill <= 1 ? [[x1, ya, q], [xt, ya, q], [xt, ya + tf, q], [xb, ya + tf, q], [xb, ya + tf + r.g, q], [xt, ya + tf + r.g, q], [xt, top, q], [x1, top, q]]
        /* a tongue narrower than the cavity : no solid block behind the groove, but a hook — a rib from the wall, a web, a rib hung from the web — every wall as thick as a rib */
        : [[x1, ya, q], [xt, ya, q], [xt, ya + tf, q], [xb, ya + tf, q], [xb, ya + tf + r.g, q], [xt, ya + tf + r.g, q], [xt, top, q], [xb + tf, top, q], [xb + tf, ya + tf, q], [x1, ya + tf, q]]]);
    }
    for (const l of o.ledges || []) { const xt = Math.min(x1 - 1, mid + l.w / 2 - 3), q = rad(tf, x1 - xt); ribs.push([l.y - tf, l.y, [[x1, l.y - tf, q], [xt, l.y - tf, q], [xt, l.y, q], [x1, l.y, q]]]); }
    ribs.sort((p, q) => p[0] - q[0]);
    for (let i = 0; i < ribs.length; i++) if (ribs[i][0] < y0 + b - 1e-6 || ribs[i][1] > y1 - (open ? 0 : b) + 1e-6 || (i && ribs[i][0] < ribs[i - 1][1] - 1e-6)) throw new Error(`Profil « fitted » : la nervure à ${Math.round(ribs[i][0] * 10) / 10} mm sort de la paroi ou en chevauche une autre.`);
    const mirror = (pts) => [...pts].reverse().map(([x, y, q]) => (q === undefined ? [W - x, y] : [W - x, y, q]));
    const right = ribs.flatMap((r) => r[2]), left = mirror(right);
    /* a screw port is an open « C » channel in a corner boss : its slot opens on the cavity, so the die needs no extra mandrel */
    const d = b ? o.ports.d : 0, k = (t + b) / 2, slot = Math.round(5.5 * d) / 10, off = Math.max(0, 0.95 - (b - t) / 2 + slot / 2);      // off : the slot leaves room for a radius between it and the floor
    const rb = Math.max(ri, Math.min(k - slot / 2 - off - 0.55, b - ri - 0.1));                               // the corner of the boss on the cavity side, as round as its faces allow
    const chan = (cy, up) => {                                                                                // up : +1 for a boss on the floor, −1 for a boss under the roof (the slot is shifted away from the wall)
      const lo = -slot / 2 + up * off, hi = slot / 2 + up * off, a0 = Math.PI + Math.asin(Math.min(1, -lo / (d / 2))), a1 = 3 * Math.PI - Math.asin(Math.min(1, hi / (d / 2))), m = Math.ceil((a1 - a0 - 1) / 0.2);
      const at = (th) => [W - k + (d / 2) * Math.cos(th), cy + (d / 2) * Math.sin(th)], pts = [[x1 - b, cy + lo, 0.4], [...at(a0), 0.4], at(a0 + 0.45)];      // the two lips of the « C » are rounded : the first and last chords are long enough to carry that radius, the next one short enough to keep the turn gentle
      for (let i = 0; i <= m; i++) pts.push(at(a0 + 0.5 + ((a1 - a0 - 1) * i) / m));
      pts.push(at(a1 - 0.45), [...at(a1), 0.4], [x1 - b, cy + hi, 0.4]); return pts; };
    const floor = b ? [[x0 + b, y0, ri], [x1 - b, y0, ri], ...chan(k, 1), [x1 - b, y0 + b, rb], [x1, y0 + b, ri]] : [[x0, y0, ri], [x1, y0, ri]], back = b ? [[x0, y0 + b, ri], [x0 + b, y0 + b, rb], ...mirror(chan(k, 1))] : [];
    const r = o.r ?? (b ? k : Math.min(2, t)), tip = rad(t);
    if (open) return { outer: { poly: [[0, 0, r], [W, 0, r], [W, H, tip], [x1, H, tip], ...[...right].reverse(), ...[...floor].reverse(), ...[...back].reverse(), ...[...left].reverse(), [x0, H, tip], [0, H, tip]] }, holes: [] };
    const roof = b ? [[x1, y1 - b, ri], [x1 - b, y1 - b, rb], ...chan(H - k, -1), [x1 - b, y1, ri], [x0 + b, y1, ri], ...mirror(chan(H - k, -1)), [x0 + b, y1 - b, rb], [x0, y1 - b, ri]] : [[x1, y1, ri], [x0, y1, ri]];
    return { outer: { rect: [0, 0, W, H], r }, holes: [{ poly: [...floor, ...right, ...roof, ...left, ...back] }] };
  },
};
export function generateProfile(def) {
  const g = PROFILE_GENERATORS[def.gen];
  if (!g) throw new Error(`Générateur de profil inconnu « ${def.gen} ». Générateurs : ${Object.keys(PROFILE_GENERATORS).join(", ")}.`);
  return g(def);
}
