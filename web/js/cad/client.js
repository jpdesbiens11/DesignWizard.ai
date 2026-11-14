/* DesignWizard.ai — page-side client of the kernel worker (promise RPC + a small build cache). */

const BASE = new URL("../../vendor/occ/", import.meta.url).href;
let worker = null, seq = 0;
const pending = new Map();
const listeners = new Set();
const builds = new Map();         // key -> {hash, promise}

function start() {
  if (worker) return worker;
  worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.stage !== undefined) { listeners.forEach((fn) => fn(m.stage)); return; }
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    if (m.ok) p.resolve(m.result); else p.reject(new Error(m.error));
  };
  worker.onerror = (e) => {
    const err = new Error("Le noyau CAO s'est arrêté : " + (e.message || "erreur inconnue") + ". Correctif : rechargez la page.");
    pending.forEach((p) => p.reject(err)); pending.clear(); worker = null; builds.clear();
  };
  return worker;
}
export function call(cmd, args = {}) {
  start();
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, cmd, base: BASE, ...args });
  });
}
/** Subscribe to kernel status texts ("Chargement du noyau…", "" when idle). */
export function onStage(fn) { listeners.add(fn); return () => listeners.delete(fn); }

const hashOf = (spec, overrides) => JSON.stringify([spec, overrides || null]);

/** Build a part (cached: the same spec is built once). Returns the built part with meshes. */
export function build(spec, overrides, key) {
  const k = key || spec.id, h = hashOf(spec, overrides), cur = builds.get(k);
  if (cur && cur.hash === h) return cur.promise;
  const promise = call("build", { spec, overrides, key: k });
  builds.set(k, { hash: h, promise });
  promise.catch(() => { if (builds.get(k) && builds.get(k).hash === h) builds.delete(k); });
  return promise;
}
export function forget(key) { builds.delete(key); return call("forget", { key }); }
export const kernel = { call, build, forget, onStage,
  step: (items, name) => call("step", { items, name }),
  hlr: (key, views, hidden) => call("hlr", { key, views, hidden }),
  interference: (pairs) => call("interference", { pairs }),
  distance: (a, b) => call("distance", { a, b }),
};
