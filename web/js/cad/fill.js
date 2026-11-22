/* DesignOrbit.ai — filling a cavity as it is done in production : the filler (potting compound, thermal gap filler, foam)
   is poured in a housing with everything already in place, and takes the room that is left. The kernel computes that
   room : the box of the container up to the filling level, less the container, less every other part. What remains is one
   solid enclosed by the walls, plus — when the walls lean or have round corners — thin slivers outside them : only the
   largest solid is kept. Runs in the worker and in the tests ; K : the kernel. */

/** place(it) : the shape of an item, placed. → { shape, volume (mm³), bbox } ; throws when nothing is left to fill. */
export function fillCavity(K, place, container, others = [], level = null) {
  const C = place(container), bb = K.bbox(C), top = level === null || level === undefined ? bb[5] : Math.min(bb[5], level);
  if (top - bb[2] < 0.05) throw new Error("Le niveau de remplissage est sous le fond du contenant.");
  const room = K.cut(K.box([bb[0], bb[1], bb[2]], [bb[3], bb[4], top]), [C, ...others.map(place)]);
  let best = null, vol = 0;
  for (const s of K.explore(room, K.oc.TopAbs_ShapeEnum.TopAbs_SOLID)) { const v = K.props(s).volume; if (v > vol) { vol = v; best = s; } }
  if (!best || vol < 1) throw new Error("Aucune cavité à remplir : le contenant est plein, ou il n'a pas de creux sous ce niveau.");
  return { shape: best, volume: vol, bbox: K.bbox(best) };
}
