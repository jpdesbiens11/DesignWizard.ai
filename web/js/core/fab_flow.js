/* DynamiteOrbit — the virtual fabrication shop, its flow (point 13 of the roadmap, JP : « les étapes se déplacent dans le flux pour en changer
   l'ordre »). The order of the phases of a part is the shop's to choose : it is kept in the part (plan.order, cad/process_plan.js honours it).
   What an order breaks is said, never forbidden : a raw part that does not come first, deburring before the cutting is over, a surface treatment
   that later work would scratch, a final check before the end of the work, packing that is not last. Pure (browser and Node). */

const WORK = (k) => /^(setup:|rework$|bend$)/.test(k);
/** The keys of the phases, in their order. */
export const flowKeys = (plan) => ((plan && plan.phases) || []).map((p) => p.key);
/** A key moved by one place (dir −1 : earlier, +1 : later). → the new order, or null when it cannot move. */
export function moveKey(keys, key, dir) { const i = keys.indexOf(key), j = i + dir; if (i < 0 || j < 0 || j >= keys.length) return null; const out = [...keys]; [out[i], out[j]] = [out[j], out[i]]; return out; }
/** A key dropped before another (a drag in the list). → the new order */
export function dropKey(keys, key, before) { if (key === before) return [...keys]; const out = keys.filter((k) => k !== key), i = before === null ? out.length : out.indexOf(before); out.splice(i < 0 ? out.length : i, 0, key); return out; }
/** What an order breaks, for the guide. plan : a routing (cad/process_plan.js) ; id : the part. → [{ level, text, field }] */
export function orderIssues(plan, id = "Pièce") {
  const keys = flowKeys(plan), out = [], at = (k) => keys.indexOf(k), title = (k) => ((plan.phases.find((p) => p.key === k) || {}).title || k), say = (level, text, field) => out.push({ level, text: `${id} — atelier : ${text}`, field });
  const lastWork = Math.max(-1, ...keys.map((k, i) => (WORK(k) ? i : -1))), firstWork = keys.findIndex(WORK);
  if (at("stock") > 0) say("warn", `« ${title(keys[0])} » vient avant « ${title("stock")} » : la pièce n'existe pas encore à ce moment-là.`, "stock");
  if (at("deburr") >= 0 && at("deburr") < lastWork) say("warn", `l'ébavurage vient avant « ${title(keys[lastWork])} » : les arêtes que ce travail fera n'auront pas été ébavurées.`, "deburr");
  if (at("surface") >= 0 && firstWork >= 0 && at("surface") < lastWork) say("warn", `le traitement de surface vient avant « ${title(keys[lastWork])} » : ce travail le rayerait ou l'enlèverait.`, "surface");
  if (at("check") >= 0 && at("check") < Math.max(lastWork, at("deburr"), at("surface"))) say("warn", "le contrôle vient avant la fin du travail : il ne contrôle pas la pièce finie.", "check");
  if (at("pack") >= 0 && at("pack") !== keys.length - 1) say("warn", "le conditionnement n'est pas la dernière phase : la pièce emballée retournerait à l'atelier.", "pack");
  return out;
}
/** What a state of the part measures, for the step card and the slides : its size and its volume. built : a built part (its bbox, its mass facts). */
export function stepMeasures(built) {
  const b = (built && built.bbox) || null, v = ((built && built.bodies) || []).reduce((s, x) => s + (Number(x.volume) || 0), 0), m = Number(built && built.mass);
  return b ? { size: [b[3] - b[0], b[4] - b[1], b[5] - b[2]].map((x) => Math.round(x * 100) / 100), volume: v > 0 ? Math.round(v) : null, mass: Number.isFinite(m) && m > 0 ? Math.round(m * 10) / 10 : null } : null;
}
/** A state with nothing in it : the shape of the part is all made by its machining. */
export const emptyState = (built) => !built || !built.bbox || !(built.bodies || []).length || built.bbox.every((v) => Math.abs(v) < 1e-9);
/** The blank a machined part starts from, when its raw stock is not said : the box of the part ; on a lathe, a bar along Z with 1 mm of stock
    on the radius and on the free end — a tube when the part is hollow from end to end (a cut cylinder along Z as long as the part). An
    assumption, said on the screen. */
export function blankSpec(spec, built) {
  const b = built.bbox, d = [b[3] - b[0], b[4] - b[1], b[5] - b[2]], c = [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2], lathe = spec.process === "cnc_turning", A = 1;
  const bore = lathe ? Math.max(0, ...(spec.features || []).filter((f) => f && f.op === "cylinder" && f.mode === "cut" && (f.axis || "Z") === "Z" && Number(f.h) >= 0.95 * d[2] && Math.hypot(((f.at || [])[0] || 0) - c[0], ((f.at || [])[1] || 0) - c[1]) < 0.01).map((f) => Number(f.d) - 2 * A)) : 0;
  const features = lathe ? [{ op: "cylinder", id: "brut", name: bore > 0 ? "Brut supposé (tube)" : "Brut supposé (barre)", d: Math.max(d[0], d[1]) + 2 * A, h: d[2] + A, at: [c[0], c[1], b[2]], axis: "Z" },
    ...(bore > 0 ? [{ op: "cylinder", id: "brut_creux", name: "Intérieur du tube brut", d: bore, h: d[2] + A + 2, at: [c[0], c[1], b[2] - 1], axis: "Z", mode: "cut" }] : [])]
    : [{ op: "box", id: "brut", name: "Brut supposé (la boîte de la pièce)", size: d, at: [b[0], b[1], b[2]] }];
  return { dw: "part/1", id: `${spec.id}-BRUT`, name: `${spec.name || spec.id} — brut`, material: spec.material, process: spec.process, params: {}, features, interfaces: [] };
}
