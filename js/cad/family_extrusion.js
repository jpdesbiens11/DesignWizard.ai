/* DynamiteOrbit.ai — "extrusion" family: a constant cross-section (aluminium or plastic) pushed through a die.
   spec.extrusion = {
     profile,            // cross-section (see profile.js); drawn in the plane normal to the extrusion axis
     length,             // extruded length
     axis: "Y",          // extrusion axis: "Y" (profile in XZ: x horizontal, z up — default), "X" (profile in YZ), "Z" (profile in XY)
     inside:  [{name, w, h, at:[a,b], clearance}],   // envelopes of what must fit INSIDE the profile (cards, cells, cables)
     outside: [{name, w, h, at:[a,b], clearance}]    // envelopes of what sits OUTSIDE against it (fans, brackets, rails)
   }
   Machining after extrusion (holes, cut-outs, end milling) goes in spec.features / spec.interfaces as for any part. */

import { normalizeProfile, pointInProfile, flattenLoop } from "./profile.js";
import { profileMetrics, sharpCorners } from "./profile_metrics.js";

const PLANE_OF = { Y: "XZ", X: "YZ", Z: "XY" };

export function compileExtrusion(ex) {
  const axis = String(ex.axis || "Y").toUpperCase();
  if (!PLANE_OF[axis]) throw new Error(`extrusion.axis « ${ex.axis} » inconnu (X, Y ou Z).`);
  const profile = normalizeProfile(ex.profile);
  const length = ex.length;
  if (typeof length !== "number" || !(length > 0)) throw new Error(`extrusion.length doit être un nombre positif (reçu ${JSON.stringify(length)}).`);
  const metrics = profileMetrics(profile);
  const flat = { outer: flattenLoop(profile.outer), holes: profile.holes.map((h) => flattenLoop(h)) };
  const envelopes = [];
  for (const [kind, list] of [["inside", ex.inside || []], ["outside", ex.outside || []]]) {
    for (const e of list) {
      const w = e.w ?? (e.size && e.size[0]), h = e.h ?? (e.size && e.size[1]), at = e.at || [0, 0], c = e.clearance ?? 0;
      if (typeof w !== "number" || typeof h !== "number") continue;
      // corners and mid-sides of the envelope grown by its clearance must be in the air for "inside" and out of the metal for "outside"
      const probes = [];
      for (const i of [-1, 0, 1]) for (const j of [-1, 0, 1]) probes.push([at[0] + i * (w / 2 + c), at[1] + j * (h / 2 + c)]);
      const inMetal = probes.filter((p) => pointInProfile(p, profile, flat)).length;
      envelopes.push({ kind, name: e.name || "?", w, h, at, clearance: c, collides: inMetal > 0, probesInMetal: inMetal });
    }
  }
  const facts = { axis, length, metrics, sharp: sharpCorners(profile), envelopes, massPerMeter: null, profile };
  return { features: [{ op: "extrude", id: "extrusion", profile, plane: PLANE_OF[axis], length }], facts };
}
