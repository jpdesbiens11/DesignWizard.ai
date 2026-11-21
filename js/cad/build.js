/* DesignWizard.ai — builds a part from its spec (the part language, see docs/PART_LANGUAGE.md).
   spec = { dw:"part/1", id, name, family, process, material, params, features[], interfaces[], extrusion?, pcb?, bodies?, elec? }
   Order: parameters -> raw stock and Shop verbs rewritten to kernel features (shop.js) -> family blocks
   (extrusion, pcb) -> features -> interfaces -> features placed after {op:"interfaces"}. */

import { resolveParams, evalDeep } from "./expr.js";
import { newState, runFeatures } from "./features.js";
import { compileInterface, interfaceType } from "./interfaces.js";
import { FACES, faceKey, bboxUnion } from "./vec.js";
import { materialOrDefault, hexToRgb } from "./materials.js";
import { lookOf } from "../core/part_look.js";
import { patternColor } from "../core/look_patterns.js";
import { compileExtrusion } from "./family_extrusion.js";
import { compilePcb } from "./family_pcb.js";
import { compileFolded } from "./family_folded.js";
import { expandSpec } from "./shop.js";
import { stockFacts, foldedStock } from "./stock.js";

export const PART_VERSION = "part/1";

function evaluated(spec, scope) {
  const ev = (x) => (x === undefined ? undefined : evalDeep(x, scope));
  return { features: ev(spec.features) || [], interfaces: ev(spec.interfaces) || [], extrusion: ev(spec.extrusion), pcb: ev(spec.pcb), folded: ev(spec.folded), bodies: ev(spec.bodies) || {} };
}

/** Build the kernel bodies of a part. Returns bodies with shapes (kernel objects), frames, facts and a log. */
export function buildPart(K, source, opts = {}) {
  const t0 = Date.now(), shopLog = [];
  const spec = expandSpec(source, shopLog);                    // stock + Shop verbs -> plain kernel features
  const { defs, scope } = resolveParams(spec.params, opts.overrides || {});
  const E = evaluated(spec, scope);
  const st = newState();
  st.log.push(...shopLog);
  if (source.stock) {
    try { st.facts.stock = stockFacts(evalDeep(source.stock, scope), source.process, source.material); }
    catch (e) { st.log.push({ level: "error", feature: "stock", msg: `Matière première : ${e.message}` }); }
  }
  const bodyMeta = {};
  let features = E.features.map((f, i) => ({ ...f, id: f.id || `f${i + 1}` }));
  if (E.pcb) { const c = compilePcb(E.pcb, spec); features = [...c.features, ...features]; Object.assign(bodyMeta, c.bodies); st.main = "board"; st.facts.pcb = c.facts; }
  if (E.extrusion) { const c = compileExtrusion(E.extrusion, spec); features = [...c.features, ...features]; st.facts.extrusion = c.facts; }
  if (E.folded) { try { const c = compileFolded(E.folded); features = [...c.features, ...features]; st.facts.folded = c.facts; if (!st.facts.stock) st.facts.stock = foldedStock(c.facts, source.material); } catch (e) { st.log.push({ level: "error", feature: "folded", msg: `Tôle pliée : ${e.message}` }); } }
  Object.assign(bodyMeta, E.bodies);

  if (spec.step) {                                             // imported geometry (supplier STEP): one body per solid
    const text = typeof spec.step === "string" ? spec.step : spec.step.text;
    const solids = K.stepRead(text), names = stepProductNames(text, solids.length);
    solids.forEach((s, i) => {
      const name = solids.length === 1 ? "main" : (names[i] || `solid${i + 1}`);
      st.bodies.set(name, s.shape); st.order.push(name);
    });
    if (!st.bodies.has("main")) st.main = st.order[0];
  }
  const marker = features.findIndex((f) => f.op === "interfaces");
  const before = marker >= 0 ? features.slice(0, marker) : features, after = marker >= 0 ? features.slice(marker + 1) : [];
  runFeatures(K, st, before);

  const ifaces = [];
  for (const raw of E.interfaces) {
    const iface = { ...raw, id: raw.id || `IF${ifaces.length + 1}` };
    try {
      const type = interfaceType(iface.type), face = faceKey(iface.face || "+Z"), F = FACES[face];
      const body = iface.body || st.main;
      let level = iface.level;
      if (level === undefined || level === null) {
        const s = st.bodies.get(body) || [...st.bodies.values()][0];
        if (!s) throw new Error("aucun volume pour porter l'interface");
        const bb = K.bbox(s);
        level = F.n[F.axis] > 0 ? bb[3 + F.axis] : bb[F.axis];
      }
      const c = compileInterface({ ...iface, body }, level);
      runFeatures(K, st, c.features);
      ifaces.push({ id: iface.id, type: iface.type, name: iface.name || type.label, key: iface.key || null, side: iface.side === "B" ? "B" : "A", ...(iface.external ? { external: true } : {}), face, at: iface.at || [0, 0],
        rot: iface.rot || 0, level, params: c.params, opts: c.opts, frame: c.frame, body, partner: iface.partner || null, net: iface.net || null });
    } catch (e) {
      st.log.push({ level: "error", feature: iface.id, msg: `Interface « ${iface.id} » : ${e.message}` });
    }
  }
  runFeatures(K, st, after);

  const bodies = [];
  let bbox = null, volume = 0, mass = 0;
  const cogAcc = [0, 0, 0];
  for (const name of st.order) {
    let shape = st.bodies.get(name);
    try { shape = K.unify(shape); } catch (e) { /* keep as built */ }
    const meta = bodyMeta[name] || {};
    const mat = materialOrDefault(meta.material || spec.material);
    const p = K.props(shape);
    const m = p.volume * mat.rho / 1000;                       // mm3 * g/cm3 / 1000 = g
    const elec = meta.elec || (name === st.main ? spec.elec : null) || {}, look = name === st.main ? lookOf(spec) : {}, color = meta.color || (look.pattern ? patternColor(look.pattern) : look.color) || mat.color;      // the look the designer gave the part paints its main body ; where a pattern cannot go (a STEP file), its ground colour stands for it
    bodies.push({ name, shape, material: mat.id, materialName: mat.name, color, opacity: meta.opacity ?? look.opacity ?? mat.opacity ?? 1, pattern: look.pattern || null, sheen: look.sheen || null,
      conductive: !!mat.conductive, cti: mat.cti ?? null, printedWiring: !!mat.printedWiring, net: meta.net || elec.net || null, elecKind: meta.kind || elec.kind || null,
      label: meta.label || null, volume: p.volume, area: p.area, bbox: p.bbox, cog: p.cog, mass: m, rgb: hexToRgb(color) });
    bbox = bboxUnion(bbox, p.bbox); volume += p.volume; mass += m;
    for (let i = 0; i < 3; i++) cogAcc[i] += p.cog[i] * m;
  }
  if (st.facts.stock && st.facts.stock.rawVolume && bodies.length) st.facts.stock.utilisation = bodies[0].volume / st.facts.stock.rawVolume;
  if (!bodies.length && !st.log.some((l) => l.level === "error")) st.log.push({ level: "error", msg: "La pièce n'a aucun volume. Correctif : donnez la matière première (« stock »), ou au moins un « box », « extrude » ou un bloc « extrusion » / « pcb »." });
  return { id: spec.id, name: spec.name, bodies, interfaces: ifaces, params: { defs, scope }, facts: st.facts, log: st.log, main: st.main,
    bbox: bbox || [0, 0, 0, 0, 0, 0], volume, mass, cog: mass > 0 ? cogAcc.map((x) => x / mass) : [0, 0, 0], ms: Date.now() - t0 };
}

/** Cheap structural validation of a spec before building (clear messages for pasted interview results). */
export function validateSpec(spec) {
  const errors = [], warnings = [];
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) return { errors: ["Le texte collé n'est pas un objet JSON de pièce."], warnings };
  if (spec.dw && !/^part\//.test(spec.dw)) errors.push(`« dw » vaut « ${spec.dw} » : ce n'est pas une pièce (attendu « ${PART_VERSION} »).`);
  if (!spec.id) warnings.push("« id » (numéro de pièce) manquant : un numéro sera attribué.");
  if (!spec.name) warnings.push("« name » manquant.");
  if (!spec.features && !spec.extrusion && !spec.pcb && !spec.stock && !spec.folded) errors.push("Aucune géométrie : il faut « stock », « features », « extrusion », « folded » ou « pcb ».");
  if (spec.stock && (typeof spec.stock !== "object" || !spec.stock.form)) errors.push("« stock » doit être un objet avec sa forme, ex. {\"form\": \"plate\", \"L\": 120, \"W\": 80, \"t\": 6}.");
  if (spec.features && !Array.isArray(spec.features)) errors.push("« features » doit être une liste.");
  if (spec.interfaces && !Array.isArray(spec.interfaces)) errors.push("« interfaces » doit être une liste.");
  for (const [i, it] of (Array.isArray(spec.interfaces) ? spec.interfaces : []).entries()) {
    try { interfaceType(it.type); } catch (e) { errors.push(`Interface ${i + 1} : ${e.message}`); }
    if (it.side && !["A", "B"].includes(it.side)) errors.push(`Interface ${it.id || i + 1} : « side » doit valoir "A" ou "B".`);
    try { faceKey(it.face || "+Z"); } catch (e) { errors.push(`Interface ${it.id || i + 1} : ${e.message}`); }
  }
  try { resolveParams(spec.params || {}); } catch (e) { errors.push(e.message); }
  if (!spec.material) warnings.push("« material » manquant : la masse et les règles DFx seront approximatives.");
  if (!spec.process) warnings.push("« process » manquant : les règles DFM ne peuvent pas être choisies.");
  return { errors, warnings };
}

/** Names of the PRODUCT entities of a STEP file, to label the solids of an imported assembly (best effort). */
export function stepProductNames(text, count) {
  const names = [];
  const re = /=\s*PRODUCT\s*\(\s*'((?:[^']|'')*)'/g;
  let m;
  while ((m = re.exec(text))) names.push(m[1].replace(/''/g, "'") || `solid${names.length + 1}`);
  const list = names.length === count + 1 ? names.slice(1) : names.length === count ? names : [];
  const seen = new Map();
  return list.map((n) => { const k = seen.get(n) || 0; seen.set(n, k + 1); return k ? `${n} #${k + 1}` : n; });
}
