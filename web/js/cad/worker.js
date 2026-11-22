/* DynamiteOrbit — kernel worker: all OpenCascade work happens here, off the main thread.
   Messages: {id, cmd, ...args} -> {id, ok, result} | {id, ok:false, error}. Progress: {stage: "text"}.
   Shapes stay in the worker, cached per part id; the page receives meshes and numbers only. */

import { sectionView } from "./section_view.js";
import { loadKernel } from "./occ.js";
import { buildPart } from "./build.js";
import { matIsIdentity, bboxTransform } from "./vec.js";
import { fillCavity } from "./fill.js";

let K = null, loading = null;
const cache = new Map();          // partId -> { bodies: [{name, shape}], rgb: {name: [r,g,b]} }

async function kernel(base) {
  if (K) return K;
  if (!loading) {
    const LOADING = "Chargement du noyau CAO"; let said = 0;
    self.postMessage({ stage: `${LOADING} (une seule fois, environ 23 Mo)…` });
    loading = loadKernel(base, {}, (got, total) => { const now = Date.now(); if (now - said < 150 && got < total) return; said = now; self.postMessage({ stage: got < total ? LOADING : "Préparation du noyau CAO…", done: got, total }); })
      .then((k) => { K = k; self.postMessage({ stage: "" }); return k; }, (e) => { loading = null; self.postMessage({ stage: "" }); throw e; });      // a download that failed can be tried again
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

/** Can the kernel still make a unit cube ? When it cannot, every feature of every part fails at once (a kernel that ran out of memory, or
    aborted) : the build is not the part's fault. */
function healthy() {
  try { const v = K.props(K.box([0, 0, 0], [1, 1, 1])).volume; K.flush(); return Math.abs(v - 1) < 1e-9; } catch (e) { return false; }
}

const COMMANDS = {
  ping: () => ({ ready: !!K }),
  /** Build a part and return its meshes. args: {spec, overrides, deflection, key} */
  build({ spec, overrides, deflection, key }) {
    const partId = key || spec.id;
    const built = buildPart(K, spec, { overrides });
    if (!built.bodies.length && built.log.some((l) => l.level === "error") && !healthy()) return { result: { sick: true, log: built.log.slice(0, 3) } };   // the kernel itself has failed : the page starts a fresh one (client.js)
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
  /** STEP of one part or of an assembly. args: {items:[{key, name, matrix, body} | {key, name, instanceName, matrix, children:[ … ]}], name}
      An item with `children` is a sub-assembly : the file keeps it as a level (core/assembly_logic.js placedTree, core/asm_scene.js stepItems). */
  step({ items, name }) {
    const ID = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const expand = (level, deep) => {
      const list = [];
      for (const it of level) {
        if (it.children) { list.push({ key: it.key, name: it.name, instanceName: it.instanceName || it.name, matrix: it.matrix || ID, children: expand(it.children, true) }); continue; }
        const c = cache.get(it.key);
        if (!c) throw new Error(`Pièce « ${it.key} » absente du noyau. Correctif : ouvrez-la une fois pour la construire.`);
        const bodies = it.body ? c.bodies.filter((b) => b.name === it.body) : c.bodies;
        bodies.forEach((b) => list.push({ key: `${it.key}/${b.name}`, name: bodies.length > 1 ? `${it.name} ${b.name}` : it.name, instanceName: it.instanceName || it.name,
          shape: b.shape, color: (it.colors && it.colors[b.name]) || it.color, matrix: it.matrix && !matIsIdentity(it.matrix) ? it.matrix : (deep || level.length > 1 || bodies.length > 1 ? ID : null) }));
      }
      return list;
    };
    const list = expand(items, false);
    const text = K.stepWrite(list, name);
    K.flush();
    return { result: text };
  },
  /** Hidden-line views of a part for the 2D drawing. args: {key, views:[{name, dir, xdir}], hidden} */
  hlr({ key, views, hidden }) {
    const shape = shapeOf(key);
    const out = {};
    for (const v of views) { if (!v.axis) { out[v.name] = K.hlr(shape, v.dir, v.xdir, hidden !== false && v.hidden !== false); continue; }
      try { out[v.name] = sectionView(K, shape, v); } catch (e) { out[v.name] = null; } }                  // a section that cannot be cut is left out : the sheet is drawn without it
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
  /** The volume a filler takes when it is poured in a housing with everything in place : the box of the container up to `level`, less the
      container and every other part. The largest solid left is kept — what the walls enclose ; slivers outside drafted or rounded walls are dropped.
      args: {container:{key, matrix}, others:[{key, matrix}], level, name} -> {step, volume, bbox} */
  fill({ container, others, level, name }) {
    const out = fillCavity(K, (it) => (it.matrix && !matIsIdentity(it.matrix) ? K.transform(shapeOf(it.key), it.matrix) : shapeOf(it.key)), container, others, level);
    const step = K.stepWrite([{ key: "fill", name: name || "Remplissage", instanceName: name || "Remplissage", shape: out.shape, matrix: null }], name || "Remplissage");
    K.flush();
    return { result: { step, volume: out.volume, bbox: out.bbox } };
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
