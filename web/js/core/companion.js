/* DesignWizard.ai — "pièce complémentaire": from a free interface of a part, generate the simplest part that carries
   the other side — a plate covering the footprint of the host face, with the matching interface placed so that the
   automatic mate drops it exactly in place. A starting point the designer then reshapes (or sends to the interview). */

import { v3 } from "../cad/vec.js";
import { INTERFACE_TYPES } from "../cad/interfaces.js";

export function companionSpec(hostSpec, hostBuilt, ifaceId, id) {
  const it = hostBuilt.interfaces.find((x) => x.id === ifaceId);
  if (!it) throw new Error(`Interface « ${ifaceId} » introuvable.`);
  const f = it.frame, bb = hostBuilt.bbox;
  let u0 = Infinity, u1 = -Infinity, w0 = Infinity, w1 = -Infinity;
  for (let k = 0; k < 8; k++) {
    const d = v3.sub([bb[k & 1 ? 3 : 0], bb[k & 2 ? 4 : 1], bb[k & 4 ? 5 : 2]], f.o), a = v3.dot(d, f.u), b = v3.dot(d, f.v);
    u0 = Math.min(u0, a); u1 = Math.max(u1, a); w0 = Math.min(w0, b); w1 = Math.max(w1, b);
  }
  const r = (x) => Math.round(x * 100) / 100, L = r(u1 - u0), W = r(w1 - w0), side = it.side === "A" ? "B" : "A";
  const plastic = /injection|fdm|mjf/.test(hostSpec.process || "");
  const t = plastic ? 2.5 : 4, type = INTERFACE_TYPES[it.type];
  const opts = side === "A" ? { ...type.optsA } : { ...type.optsB, ...(it.type === "bolt_pattern" ? { thread: plastic ? "insert" : "tapped", depth: "through" } : {}) };
  if (it.type === "cutout" && side === "A") opts.depth = "through";
  return {
    dw: "part/1", id, name: `${it.partner && it.partner !== hostSpec.name ? it.partner : `Pièce complémentaire de ${hostSpec.name || hostSpec.id}`}`, family: "plate",
    process: plastic ? hostSpec.process : "cnc_milling", material: plastic ? hostSpec.material : "AL6061-T6",
    function: `Porte l'autre côté de l'interface « ${it.name} » de ${hostSpec.id}. Générée automatiquement : à remodeler.`,
    params: { L: { value: L, min: Math.max(5, r(L / 3)), max: r(L * 2), step: 0.5, unit: "mm", label: "Longueur", group: "Enveloppe" }, W: { value: W, min: Math.max(5, r(W / 3)), max: r(W * 2), step: 0.5, unit: "mm", label: "Largeur", group: "Enveloppe" },
      t: { value: t, min: 1, max: 20, step: 0.5, unit: "mm", label: "Épaisseur", group: "Enveloppe" }, rc: { value: Math.min(4, r(Math.min(L, W) / 8)), min: 0, max: 20, step: 0.5, unit: "mm", label: "Rayon des coins", group: "Détails" },
      ax: { value: r(-u0), min: 0, max: r(L * 2), step: 0.5, unit: "mm", label: "Position de l'interface (X)", group: "Interface" }, ay: { value: r(-w0), min: 0, max: r(W * 2), step: 0.5, unit: "mm", label: "Position de l'interface (Y)", group: "Interface" } },
    interfaces: [{ id: "IF1", type: it.type, name: it.name, key: it.key || `${hostSpec.id}_${it.id}`.toLowerCase(), partner: hostSpec.name || hostSpec.id, side, face: "-Z", at: ["ax", "ay"], params: JSON.parse(JSON.stringify(it.params)), opts }],
    features: [{ op: "extrude", id: "plaque", name: "Plaque", profile: { rect: [0, 0, "L", "W"], r: "rc" }, plane: "XY", length: "t" }],
  };
}
