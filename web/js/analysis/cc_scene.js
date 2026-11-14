/* DesignWizard.ai — builds the scene of the isolation analysis from the complete assembly: every body of every
   instance becomes a world-space triangle mesh with its electrical role.
   Role of a body: "conductor" (conductive material with a net), "floating" (conductive, no net), "insulator", "ignore". */

import { matPoint, matIsIdentity } from "../cad/vec.js";

/** IEC 60664-1 material group from the comparative tracking index (same thresholds as cc_rules.materialGroup). */
function materialGroup(cti) {
  if (cti === null || cti === undefined || cti === "") return null;
  const v = Number(cti);
  return v >= 600 ? "I" : v >= 400 ? "II" : v >= 175 ? "IIIa" : "IIIb";
}

/** One scene body from a tessellated part body. `mesh` = {pos, idx}; `matrix` = world placement (column-major 4x4). */
export function sceneBody(id, name, body, mesh, matrix, override = {}) {
  let pos = mesh.pos;
  if (matrix && !matIsIdentity(matrix)) {
    pos = new Float32Array(mesh.pos.length);
    for (let i = 0; i < mesh.pos.length; i += 3) { const p = matPoint(matrix, [mesh.pos[i], mesh.pos[i + 1], mesh.pos[i + 2]]); pos[i] = p[0]; pos[i + 1] = p[1]; pos[i + 2] = p[2]; }
  }
  const net = override.net !== undefined ? override.net : body.net;
  let kind = override.kind || body.elecKind;
  if (kind === "chassis") kind = "conductor";
  if (kind === "none") kind = "ignore";
  if (!kind || kind === "conductor" || kind === "floating") {
    if (body.conductive || kind === "conductor" || kind === "floating") kind = net ? "conductor" : "floating";
    else kind = "insulator";
  }
  if (kind === "insulator" && body.conductive && !override.kind) kind = net ? "conductor" : "floating";
  const cti = override.cti ?? body.cti;
  return { id, name, kind, net: kind === "conductor" ? net : null, group: kind === "insulator" ? (materialGroup(cti) || "IIIb") : null,
    printed: !!body.printedWiring, material: body.material, pos, idx: mesh.idx, undefinedMaterial: kind === "insulator" && (cti === null || cti === undefined) };
}
