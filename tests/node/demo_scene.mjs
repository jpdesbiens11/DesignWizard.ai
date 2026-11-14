// Builds the DEMO-HVB scene (world-space meshes with electrical roles) for the isolation-engine tests.
import { kernel } from "./kernel_helper.mjs";
import { buildPart } from "../../web/js/cad/build.js";
import { sceneBody } from "../../web/js/analysis/cc_scene.js";
import { DEMO_HVB_PARTS, DEMO_HVB_ASSEMBLY, DEMO_HVB_EXPECTED } from "../../web/js/demo/demo_hvb.js";

export async function demoHvbScene(deflection) {
  const K = await kernel(), bodies = [];
  for (const spec of DEMO_HVB_PARTS) {
    const built = buildPart(K, spec);
    if (built.log.some((l) => l.level === "error")) throw new Error(JSON.stringify(built.log));
    for (const b of built.bodies) {
      const mesh = K.tessellate(b.shape, deflection);
      bodies.push(sceneBody(`${spec.id}/${b.name}`, spec.name, b, { pos: mesh.pos, idx: mesh.idx }, null));
    }
  }
  K.flush();
  return { bodies, nets: DEMO_HVB_ASSEMBLY.isolation.nets, expected: DEMO_HVB_EXPECTED };
}
