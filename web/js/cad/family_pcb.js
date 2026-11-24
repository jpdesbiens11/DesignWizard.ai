/* DynamiteOrbit.ai — "pcb" family: a printed circuit board as a mechanical + electrical envelope.
   spec.pcb = {
     outline,                    // profile in XY (default: rect from size)
     size: [w, h], r,            // shortcut for a rectangular board with corner radius r
     t: 1.6,                     // board thickness; the bottom of the board is z = 0
     holes: [{at:[x,y] | [[x,y],...], d, plated}],      // mounting holes are better given as a bolt_pattern interface (side A)
     components: [{ref, name, kind, at:[x,y], size:[w,h,z], side:"top"|"bottom", rot, net, conductive, color}],
     zones: [{net, side, rect:[x,y,w,h] | profile, name}],     // copper areas that matter for isolation (HV, LV, chassis)
     nets: {"HV+": {kind:"dc", voltage:400, floating:false}, ...}
   }
   Bodies: "board" (FR4), one body per component (its `ref`) and one per copper zone ("Cu:<net>#n"), so the isolation
   analysis sees each conductor with its net. */

import { normalizeProfile, profileBBox, profileArea } from "./profile.js";
import { netColor } from "./materials.js";

const KIND = {
  ic: { color: "#23272d", fr: "Circuit intégré" }, mcu: { color: "#1f2328", fr: "CPU / MCU" }, connector: { color: "#e9e4d4", fr: "Connecteur" },
  capacitor: { color: "#3d5a80", fr: "Condensateur" }, inductor: { color: "#5c4d3c", fr: "Inductance" }, relay: { color: "#2a5d8f", fr: "Relais" },
  transformer: { color: "#b08d2f", fr: "Transformateur" }, mosfet: { color: "#2b2b2b", fr: "MOSFET / module de puissance" }, sensor: { color: "#6b4e9b", fr: "Capteur" },
  heatsink: { color: "#b9c6ce", fr: "Dissipateur" }, terminal: { color: "#c9a94f", fr: "Borne" }, fuse: { color: "#d8d2c0", fr: "Fusible" },
  resistor: { color: "#3b3b3b", fr: "Résistance" }, optocoupler: { color: "#f0efe9", fr: "Optocoupleur / isolateur" }, other: { color: "#3a3f46", fr: "Composant" },
};
export const PCB_KINDS = KIND;
const COPPER_T = 0.07;      // drawn thickness of a copper zone (2 oz); thin enough not to disturb the envelope

export function compilePcb(pcb, spec) {
  const t = pcb.t ?? 1.6;
  if (!(t > 0)) throw new Error(`pcb.t (épaisseur) doit être positif (reçu ${t}).`);
  const outlineDef = pcb.outline || (pcb.size ? { rect: [0, 0, pcb.size[0], pcb.size[1]], r: pcb.r || 0 } : null);
  if (!outlineDef) throw new Error("pcb : donnez « outline » (profil) ou « size » [largeur, hauteur].");
  const outline = normalizeProfile(outlineDef), bb = profileBBox(outline);
  const features = [{ op: "extrude", id: "board", body: "board", profile: outline, plane: "XY", at: 0, length: t }];
  const bodies = { board: { material: pcb.material || spec.material || "FR4", kind: "insulator", label: "Board" } };
  const facts = { t, bbox: bb, area: profileArea(outline), holes: [], components: [], zones: [], nets: pcb.nets || {} };
  (pcb.holes || []).forEach((h, i) => {
    features.push({ op: "hole", id: `pcb.hole${i + 1}`, body: "board", face: "+Z", at: h.at, d: h.d, depth: "through", start: t });
    facts.holes.push({ d: h.d, plated: !!h.plated });
  });
  (pcb.zones || []).forEach((z, i) => {
    const name = `Cu:${z.net || "?"}#${i + 1}`, top = (z.side || "top") !== "bottom";
    const def = z.profile || (z.rect ? { rect: z.rect, r: z.r || 0 } : z.circle ? { circle: z.circle } : null);
    if (!def) throw new Error(`pcb.zones[${i}] : donnez « rect », « circle » ou « profile ».`);
    features.push({ op: "extrude", id: `pcb.zone${i + 1}`, body: name, profile: def, plane: "XY", at: top ? t : -COPPER_T, length: COPPER_T });
    bodies[name] = { material: "CU-C110", net: z.net || null, kind: "conductor", color: netColor(z.net), label: z.name || `Zone ${z.net || ""}` };
    facts.zones.push({ net: z.net || null, side: top ? "top" : "bottom", body: name });
  });
  const seen = new Set();
  (pcb.components || []).forEach((c, i) => {
    let ref = String(c.ref || `X${i + 1}`);
    while (seen.has(ref)) ref += "'";
    seen.add(ref);
    const [w, h, z] = c.size || [5, 5, 2], top = (c.side || "top") !== "bottom", at = c.at || [0, 0];
    const kind = KIND[c.kind] ? c.kind : "other";
    const rot = ((c.rot || 0) % 180 + 180) % 180, ww = Math.abs(rot - 90) < 1e-6 ? h : w, hh = Math.abs(rot - 90) < 1e-6 ? w : h;
    features.push({ op: "box", id: `pcb.${ref}`, body: ref, size: [ww, hh, z], at: [at[0] - ww / 2, at[1] - hh / 2, top ? t + (c.standoff || 0) : -z - (c.standoff || 0)] });
    const conductive = c.conductive ?? ["heatsink", "terminal"].includes(kind);
    bodies[ref] = { material: conductive ? (c.material || "AL6063-T5") : (c.material || "GENERIC-COMPONENT"), color: c.color || KIND[kind].color, net: c.net || null,
      kind: conductive ? (c.net ? "conductor" : "floating") : "insulator", label: `${ref}${c.name ? " · " + c.name : ""}` };
    facts.components.push({ ref, name: c.name || "", kind, at, size: [ww, hh, z], side: top ? "top" : "bottom", net: c.net || null,
      edge: Math.min(at[0] - ww / 2 - bb[0], bb[2] - at[0] - ww / 2, at[1] - hh / 2 - bb[1], bb[3] - at[1] - hh / 2) });
  });
  return { features, bodies, facts };
}
