/* DynamiteOrbit.ai — page-side client of the kernel worker (promise RPC + a small build cache). */

const BASE = new URL("../../vendor/occ/", import.meta.url).href;
let worker = null, seq = 0, crashed = false;      // crashed : the kernel stopped and was started again, and nothing has answered since
const pending = new Map();
const listeners = new Set();
const builds = new Map();         // key -> {hash, promise}
let stageNow = { text: "", done: 0, total: 0 };      // what the kernel is doing : its words, and the bytes of its file while it arrives
const say = (s) => { stageNow = s; listeners.forEach((fn) => fn(s.text, s)); };
/** The error of an operation the user stopped : `cancelled` is true. */
export class Cancelled extends Error { constructor(m = "Opération annulée.") { super(m); this.cancelled = true; } }

function start() {
  if (worker) return worker;
  worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.stage !== undefined) { say({ text: m.stage, done: m.done || 0, total: m.total || 0 }); return; }
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id); crashed = false;
    if (m.ok) p.resolve(m.result); else p.reject(new Error(m.error));
  };
  worker.onerror = (e) => {
    if (!crashed && pending.size) { crashed = true; if (e.preventDefault) e.preventDefault(); restart(); return; }      // once : a fresh kernel takes what was waiting
    const err = new Error("Le noyau CAO s'est arrêté : " + (e.message || "erreur inconnue") + ". Correctif : rechargez la page.");
    pending.forEach((p) => p.reject(err)); pending.clear(); worker = null; builds.clear(); crashed = false; say({ text: "", done: 0, total: 0 });
  };
  return worker;
}
export function call(cmd, args = {}) {
  start();
  return new Promise((resolve, reject) => {
    const id = ++seq, msg = { id, cmd, base: BASE, ...args };
    pending.set(id, { resolve, reject, msg });
    worker.postMessage(msg);
  });
}
/** A kernel that has failed is put down and a fresh one takes what was waiting, in the same order (the shapes the old one kept are gone :
    a part is built again when asked for). How many times it happened, for the words of the studio. */
let restarts = 0;
export const kernelRestarts = () => restarts;
export function restart() {
  if (worker) { worker.terminate(); worker = null; }
  builds.clear(); restarts++; say({ text: "", done: 0, total: 0 });
  const again = [...pending.values()]; pending.clear();
  for (const p of again) { start(); pending.set(p.msg.id, p); worker.postMessage(p.msg); }
}
/** Subscribe to kernel status texts ("Chargement du noyau…", "" when idle) : fn(text, { text, done, total }) — done and total are the bytes of the kernel file while it arrives. */
export function onStage(fn) { listeners.add(fn); return () => listeners.delete(fn); }
/** What the kernel is doing now : { text, done, total }. */
export const stage = () => stageNow;
/** Stops what the kernel is doing : every operation in flight is refused with a Cancelled error, and the kernel starts afresh at the next call
    (the shapes it kept are gone : a part is built again when asked for). True when something was running. */
export function cancel() {
  const busy = pending.size > 0 || !!stageNow.text;
  if (worker) { worker.terminate(); worker = null; }
  const err = new Cancelled(); pending.forEach((p) => p.reject(err)); pending.clear(); builds.clear(); say({ text: "", done: 0, total: 0 });
  return busy;
}

const hashOf = (spec, overrides) => JSON.stringify([spec, overrides || null]);

/** Build a part (cached: the same spec is built once). Returns the built part with meshes. */
export function build(spec, overrides, key, again = false) {
  const k = key || spec.id, h = hashOf(spec, overrides), cur = builds.get(k);
  if (cur && cur.hash === h) return cur.promise;
  const promise = call("build", { spec, overrides, key: k }).then((r) => {      // the kernel failed, not the part : a fresh kernel builds it once more
    if (!r || !r.sick) return r;
    const first = (r.log && r.log[0] && r.log[0].msg) || "";
    if (again) throw new Error(`Le noyau CAO ne construit plus rien, même relancé${first ? ` (${first})` : ""}. Correctif : rechargez la page.`);
    restart();
    return build(spec, overrides, key, true);
  });
  builds.set(k, { hash: h, promise });
  promise.catch(() => { if (builds.get(k) && builds.get(k).hash === h) builds.delete(k); });
  return promise;
}
export function forget(key) { builds.delete(key); return call("forget", { key }); }
export const kernel = { call, build, forget, onStage, stage, cancel, restart,
  step: (items, name) => call("step", { items, name }),
  hlr: (key, views, hidden) => call("hlr", { key, views, hidden }),
  hlrAsm: (items, views, hidden) => call("hlrAsm", { items, views, hidden }),
  fill: (container, others, level, name) => call("fill", { container, others, level, name }),
  interference: (pairs) => call("interference", { pairs }),
  distance: (a, b) => call("distance", { a, b }),
  recognize: (key) => call("recognize", { key }),      // the faces and cylinders of a part built, for its interfaces (core/step_interfaces.js)
};
