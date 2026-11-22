/* DesignOrbit.ai — worker of the isolation analysis: measures clearance and creepage paths off the main thread.
   Message in: {id, bodies, pairs:[{a, b, x}], opts}. Messages out: {id, progress:{done,total,pair}} then {id, ok, results}. */

import { prepareScene, measurePair } from "./cc_paths.js";

self.onmessage = (e) => {
  const { id, bodies, pairs, opts } = e.data;
  try {
    const scene = prepareScene(bodies, opts || {});
    const results = [];
    pairs.forEach((p, k) => {
      self.postMessage({ id, progress: { done: k, total: pairs.length, pair: `${p.a} ↔ ${p.b}` } });
      let r;
      try { r = measurePair(scene, p.a, p.b, { ...(opts || {}), x: p.x, maxClearance: p.maxClearance, maxCreepage: p.maxCreepage }); }
      catch (err) { r = { error: err.message || String(err), clearance: { d: null, path: [] }, creepage: { d: null, path: [] } }; }
      results.push({ a: p.a, b: p.b, ...r });
    });
    self.postMessage({ id, ok: true, results });
  } catch (err) { self.postMessage({ id, ok: false, error: err.message || String(err) }); }
};
