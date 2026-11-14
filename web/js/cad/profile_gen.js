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
    const side = o.side ?? Math.max(o.t, sd + 1.2), r = o.r ?? 2, x0 = side, x1 = o.W - side, y0 = o.t, y1 = o.H - o.t, ri = 0.4;
    if (x1 - x0 < 2 || y1 - y0 < 2) throw new Error("Profil « card_enclosure » : les parois sont plus épaisses que le profilé.");
    const inner = [[x0, y0, ri], [x1, y0, ri]];
    for (let i = 0; i < n; i++) { const y = y0 + first + i * pitch; if (y + st > y1 - 0.5) break; inner.push([x1, y], [x1 + sd, y, 0.2], [x1 + sd, y + st, 0.2], [x1, y + st]); }
    inner.push([x1, y1, ri], [x0, y1, ri]);
    for (let i = n - 1; i >= 0; i--) { const y = y0 + first + i * pitch; if (y + st > y1 - 0.5) continue; inner.push([x0, y + st], [x0 - sd, y + st, 0.2], [x0 - sd, y, 0.2], [x0, y]); }
    return { outer: { rect: [0, 0, o.W, o.H], r }, holes: [{ poly: inner }] };
  },
};
export function generateProfile(def) {
  const g = PROFILE_GENERATORS[def.gen];
  if (!g) throw new Error(`Générateur de profil inconnu « ${def.gen} ». Générateurs : ${Object.keys(PROFILE_GENERATORS).join(", ")}.`);
  return g(def);
}
