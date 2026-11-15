/* DesignWizard.ai — kernel worker: all OpenCascade work happens here, off the main thread.
   Messages: {id, cmd, ...args} -> {id, ok, result} | {id, ok:false, error}. Progress: {stage: "text"}.
   Shapes stay in the worker, cached per part id; the page receives meshes and numbers only. */

import { loadKernel } from "./occ.js";
import { buildPart } from "./build.js";
import { matIsIdentity, bboxTransform } from "./vec.js";

let K = null, loading = null;
const cache = new Map();          // partId -> { bodies: [{name, shape}], rgb: {name: [r,g,b]} }

async function kernel(base) {
  if (K) return K;
  if (!loading) {
    self.postMessage({ stage: "Chargement du noyau CAO (une seule fois, environ 23 Mo)…" });
    loading = loadKernel(base).then((k) => { K = k; self.postMessage({ stage: "" }); return k; });
  }
  return loading;
}
function drop(partId) {
  const c = cache.get(partId);
  if (!c) return;
  for (const b of c.bodies) { try { if (!b.shape.isDeleted()) b.shape.delete(); } catch (e) { /* gone */ } }
  cache.delete(partId);
}
function shapeOf(partId, body) {
  const c = cache.get(partId);
  if (!c) throw new Error(`Pièce « ${partId} » absente du noyau. Correctif : reconstruisez-la.`);
  if (body) { const b = c.bodies.find((x) => x.name === body); if (!b) throw new Error(`Corps « ${body} » introuvable dans « ${partId} ».`); return b.shape; }
  return c.bodies.length === 1 ? c.bodies[0].shape : K.compound(c.bodies.map((b) => b.shape));
}

const COMMANDS = {
  ping: () => ({ ready: !!K }),
  /** Build a part and return its meshes. args: {spec, overrides, deflection, key} */
  build({ spec, overrides, deflection, key }) {
    const partId = key || spec.id;
    const built = buildPart(K, spec, { overrides });
    const transfer = [], bodies = [];
    for (const b of built.bodies) {
      const m = K.tessellate(b.shape, deflection);
      transfer.push(m.pos.buffer, m.nrm.buffer, m.idx.buffer, m.faceOf.buffer, m.epos.buffer, m.edgeOf.buffer);
      const { shape, ...meta } = b;
      bodies.push({ ...meta, mesh: m });
    }
    drop(partId);
    cache.set(partId, { bodies: built.bodies.map((b) => ({ name: b.name, shape: b.shape })) });
    K.flush(built.bodies.map((b) => b.shape));
    const facts = JSON.parse(JSON.stringify(built.facts, (k, v) => (k === "profile" && v && v.outer ? { outer: v.outer, holes: v.holes } : v)));
    return { result: { ...built, bodies, facts }, transfer };
  },
  forget({ key }) { drop(key); return { result: true }; },
  /** STEP of one part or of an assembly. args: {items:[{key, name, matrix, body}], name} */
  step({ items, name }) {
    const list = [];
    for (const it of items) {
      const c = cache.get(it.key);
      if (!c) throw new Error(`Pièce « ${it.key} » absente du noyau. Correctif : ouvrez-la une fois pour la construire.`);
      const bodies = it.body ? c.bodies.filter((b) => b.name === it.body) : c.bodies;
      bodies.forEach((b) => list.push({ key: `${it.key}/${b.name}`, name: bodies.length > 1 ? `${it.name} ${b.name}` : it.name, instanceName: it.instanceName || it.name,
        shape: b.shape, color: (it.colors && it.colors[b.name]) || it.color, matrix: it.matrix && !matIsIdentity(it.matrix) ? it.matrix : (items.length > 1 || bodies.length > 1 ? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] : null) }));
    }
    const text = K.stepWrite(list, name);
    K.flush();
    return { result: text };
  },
  /** Hidden-line views of a part for the 2D drawing. args: {key, views:[{name, dir, xdir}], hidden} */
  hlr({ key, views, hidden }) {
    const shape = shapeOf(key);
    const out = {};
    for (const v of views) out[v.name] = K.hlr(shape, v.dir, v.xdir, hidden !== false && v.hidden !== false);
    K.flush();
    return { result: out };
  },
  /** Hidden-line views of an assembly : every instance placed, projected as one shape. args: {items:[{key, matrix}], views, hidden} */
  hlrAsm({ items, views, hidden }) {
    const shapes = items.map((it) => (it.matrix && !matIsIdentity(it.matrix) ? K.transform(shapeOf(it.key), it.matrix) : shapeOf(it.key)));
    const shape = shapes.length === 1 ? shapes[0] : K.compound(shapes), out = {};
    for (const v of views) out[v.name] = K.hlr(shape, v.dir, v.xdir, hidden === true && v.hidden !== false);
    K.flush();
    return { result: out };
  },
  /** Interference between instances. args: {pairs:[{a:{key, matrix}, b:{key, matrix}}]} -> volumes in mm3 */
  interference({ pairs }) {
    const out = [];
    for (const p of pairs) {
      try {
        const sa = K.transform(shapeOf(p.a.key), p.a.matrix), sb = K.transform(shapeOf(p.b.key), p.b.matrix);
        const com = K.common(sa, sb), pr = K.props(com);
        out.push({ volume: pr.volume > 1e-3 ? pr.volume : 0, at: pr.volume > 1e-3 ? pr.cog : null, bbox: pr.volume > 1e-3 ? pr.bbox : null });
      } catch (e) { out.push({ volume: null, error: e.message }); }
      K.flush();
    }
    return { result: out };
  },
  /** Minimum distance between two instances. */
  distance({ a, b }) {
    const d = K.distance(K.transform(shapeOf(a.key, a.body), a.matrix), K.transform(shapeOf(b.key, b.body), b.matrix));
    K.flush();
    return { result: d };
  },
  bboxWorld({ key, matrix }) { return { result: bboxTransform(K.bbox(shapeOf(key)), matrix) }; },
};

self.onmessage = async (e) => {
  const { id, cmd, base, ...args } = e.data;
  try {
    await kernel(base);
    const fn = COMMANDS[cmd];
    if (!fn) throw new Error(`Commande noyau inconnue « ${cmd} ».`);
    const out = await fn(args);
    self.postMessage({ id, ok: true, result: out.result }, out.transfer || []);
  } catch (err) {
    try { K && K.flush(); } catch (e2) { /* ignore */ }
    let msg = err && err.message ? err.message : String(err);
    if (typeof err === "number") msg = "Le noyau CAO a refusé cette géométrie (erreur interne). Correctif : annulez la dernière modification ou simplifiez la feature.";
    self.postMessage({ id, ok: false, error: msg });
  }
};
